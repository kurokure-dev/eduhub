package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import com.example.eduhub.course.dto.admin.AdminCourseDetailResponse;
import com.example.eduhub.course.dto.admin.AdminSessionResponse;
import com.example.eduhub.course.dto.admin.CourseRequest;
import com.example.eduhub.course.dto.admin.SessionRequest;
import com.example.eduhub.course.service.AdminCourseService;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.service.DuplicateEnrollmentException;
import com.example.eduhub.enrollment.service.EnrollmentService;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 수강 신청 동시성 테스트 (NFR-01).
 *
 * <p>주의: 클래스·메서드에 {@code @Transactional}이 없어 데이터가 공유 개발 DB(D-15)에 실제로 커밋된다. 만든 과정은
 * {@code @AfterEach}에서 지운다. 개발자가 직접 실행한다.
 *
 * <p>래치를 풀어도 실제 동시 진입 수는 Hikari 풀(기본 10)이 제한한다. 원격 DB에서 직렬 처리가 느릴 수 있어 연결 대기·전체 타임아웃을 120초로 둔다.
 */
@SpringBootTest(properties = "spring.datasource.hikari.connection-timeout=120000")
@ActiveProfiles("test")
class EnrollmentConcurrencyTest {

  private static final Logger log = LoggerFactory.getLogger(EnrollmentConcurrencyTest.class);
  private static final long TIMEOUT_SECONDS = 120;

  @Autowired private EnrollmentService enrollmentService;
  @Autowired private AdminCourseService adminCourseService;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private TransactionTemplate transactionTemplate;

  /** 테스트가 만든 과정 id. 실패해도 @AfterEach에서 지운다. */
  private final List<Long> createdCourseIds = Collections.synchronizedList(new ArrayList<>());

  /** 스레드 하나의 결과. 값과 예외 중 하나만 채워진다. */
  private record Outcome(Object value, Throwable error) {}

  @AfterEach
  void cleanUp() {
    List<Long> courseIds = new ArrayList<>(createdCourseIds);
    createdCourseIds.clear();
    List<Long> failed = new ArrayList<>();
    RuntimeException first = null;
    // 과정 하나의 정리가 실패해도 나머지는 계속 지운다
    for (Long courseId : courseIds) {
      try {
        jdbcTemplate.update(
            "DELETE FROM enrollment WHERE session_id IN"
                + " (SELECT id FROM course_session WHERE course_id = ?)",
            courseId);
        jdbcTemplate.update("DELETE FROM course_session WHERE course_id = ?", courseId);
        jdbcTemplate.update("DELETE FROM course WHERE id = ?", courseId);
      } catch (RuntimeException e) {
        log.error("테스트 데이터 정리 실패 courseId={}", courseId, e);
        failed.add(courseId);
        if (first == null) {
          first = e;
        }
      }
    }
    if (first != null) {
      throw new IllegalStateException("테스트 데이터 정리 실패, 수동 삭제 필요 courseId=" + failed, first);
    }
  }

  @Test
  @DisplayName("마지막 1자리에 100명이 동시에 신청해도 확정은 정확히 1명이고 정원을 넘지 않는다 (NFR-01, D-35)")
  void lastSeatWith100Threads() throws Exception {
    String prefix = uniquePrefix();
    SessionIds ids = createSession(10, prefix);
    fillConfirmed(ids.sessionId(), prefix, 9);

    List<Callable<Object>> tasks = new ArrayList<>();
    for (int i = 0; i < 100; i++) {
      String employeeId = prefix + "-N" + i;
      tasks.add(() -> enrollmentService.enroll(ids.sessionId(), employeeId));
    }
    long start = System.nanoTime();
    List<Outcome> outcomes = runConcurrently(tasks);
    log.info("N1 동시 신청 100건 소요: {} ms", (System.nanoTime() - start) / 1_000_000);

    assertThat(errorsByType(outcomes)).as("예외 타입별 건수").isEmpty();
    long confirmedResponses =
        outcomes.stream()
            .map(o -> (EnrollmentResponse) o.value())
            .filter(r -> r.status() == EnrollmentStatus.CONFIRMED)
            .count();
    assertThat(confirmedResponses).as("응답 중 CONFIRMED").isEqualTo(1);

    assertThat(countByStatus(ids.sessionId(), "CONFIRMED")).isEqualTo(10);
    assertThat(confirmedCount(ids.sessionId())).isEqualTo(10);
    assertThat(countByStatus(ids.sessionId(), "WAITING")).isEqualTo(99);
    Integer waitingWithOrder =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM enrollment WHERE session_id = ?"
                + " AND status = 'WAITING' AND waiting_order IS NOT NULL",
            Integer.class,
            ids.sessionId());
    assertThat(waitingWithOrder).as("waiting_order가 채워진 대기 행").isZero();
  }

  @Test
  @DisplayName("같은 사번이 동시에 20번 신청하면 1건만 성공하고 나머지는 중복 신청 예외다 (NFR-01, D-07)")
  void sameEmployeeWith20Threads() throws Exception {
    String prefix = uniquePrefix();
    SessionIds ids = createSession(50, prefix);
    String employeeId = prefix + "-SAME";

    List<Callable<Object>> tasks = new ArrayList<>();
    for (int i = 0; i < 20; i++) {
      tasks.add(() -> enrollmentService.enroll(ids.sessionId(), employeeId));
    }
    long start = System.nanoTime();
    List<Outcome> outcomes = runConcurrently(tasks);
    log.info("N2 같은 사번 동시 신청 20건 소요: {} ms", (System.nanoTime() - start) / 1_000_000);

    long successes = outcomes.stream().filter(o -> o.error() == null).count();
    Map<String, Integer> errors = errorsByType(outcomes);
    assertThat(successes).as("성공 건수").isEqualTo(1);
    assertThat(errors)
        .as("예외 타입별 건수 (중복 신청 예외만 19건이어야 한다)")
        .isEqualTo(Map.of(DuplicateEnrollmentException.class.getName(), 19));

    Integer rows =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM enrollment WHERE session_id = ? AND employee_id = ?",
            Integer.class,
            ids.sessionId(),
            employeeId);
    assertThat(rows).as("그 사번의 행 수").isEqualTo(1);
  }

  @Test
  @DisplayName("신청과 관리자 회차 수정이 동시에 일어나도 confirmed_count가 어긋나지 않는다 (NFR-01, D-29, D-38)")
  void enrollAndAdminUpdateConcurrently() throws Exception {
    String prefix = uniquePrefix();
    // 남은 자리가 많아야 신청이 계속 confirmed_count를 바꿔 lost update가 드러난다
    SessionIds ids = createSession(60, prefix);
    fillConfirmed(ids.sessionId(), prefix, 9);

    List<Callable<Object>> tasks = new ArrayList<>();
    List<String> changedPlaces = new ArrayList<>();
    for (int i = 0; i < 50; i++) {
      String employeeId = prefix + "-N" + i;
      tasks.add(() -> enrollmentService.enroll(ids.sessionId(), employeeId));
      // 신청 사이사이에 관리자 수정을 섞는다 (같은 정원, 장소만 변경. D-38)
      if (i % 10 == 5) {
        String place = "변경된 장소-" + prefix + "-" + i;
        changedPlaces.add(place);
        tasks.add(
            () ->
                adminCourseService.updateSession(
                    ids.courseId(),
                    ids.sessionId(),
                    new SessionRequest(LocalDate.of(2030, 1, 1), place, 60)));
      }
    }
    assertThat(changedPlaces).hasSize(5);
    long start = System.nanoTime();
    List<Outcome> outcomes = runConcurrently(tasks);
    log.info("N3 신청 50건과 회차 수정 5건 동시 실행 소요: {} ms", (System.nanoTime() - start) / 1_000_000);

    assertThat(errorsByType(outcomes)).as("예외 타입별 건수").isEmpty();
    Integer confirmedRows = countByStatus(ids.sessionId(), "CONFIRMED");
    assertThat(confirmedCount(ids.sessionId()))
        .as("confirmed_count와 CONFIRMED 행 수")
        .isEqualTo(confirmedRows);
    assertThat(confirmedRows).isEqualTo(59);
    Integer capacity =
        jdbcTemplate.queryForObject(
            "SELECT capacity FROM course_session WHERE id = ?", Integer.class, ids.sessionId());
    assertThat(capacity).as("정원").isEqualTo(60);
    String place =
        jdbcTemplate.queryForObject(
            "SELECT place FROM course_session WHERE id = ?", String.class, ids.sessionId());
    assertThat(place).as("관리자 수정이 반영된 장소").isIn(changedPlaces);
  }

  // ---- 준비 ----

  private record SessionIds(Long courseId, Long sessionId) {}

  /** 고유 제목의 과정과 회차를 만들어 커밋한다. */
  private SessionIds createSession(int capacity, String prefix) {
    return transactionTemplate.execute(
        status -> {
          AdminCourseDetailResponse course =
              adminCourseService.create(
                  new CourseRequest("동시성테스트-" + prefix, "테스트", "NFR-01 동시성 테스트용. 자동 삭제됨"));
          createdCourseIds.add(course.id());
          AdminSessionResponse session =
              adminCourseService.createSession(
                  course.id(), new SessionRequest(LocalDate.of(2030, 1, 1), "테스트 장소", capacity));
          return new SessionIds(course.id(), session.id());
        });
  }

  /** 순차 신청으로 확정자를 만든다 (각각 커밋). */
  private void fillConfirmed(Long sessionId, String prefix, int count) {
    for (int i = 0; i < count; i++) {
      EnrollmentResponse response = enrollmentService.enroll(sessionId, prefix + "-P" + i);
      assertThat(response.status()).isEqualTo(EnrollmentStatus.CONFIRMED);
    }
  }

  /** 사번 최대 길이(20자)를 넘지 않는 고유 접두사. */
  private static String uniquePrefix() {
    return "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
  }

  // ---- 실행 ----

  /** 모든 작업을 래치로 동시에 출발시키고, 시간 안에 끝나지 않으면 실패한다. */
  private List<Outcome> runConcurrently(List<Callable<Object>> tasks) throws InterruptedException {
    int n = tasks.size();
    ExecutorService executor = Executors.newFixedThreadPool(n);
    CountDownLatch ready = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(n);
    List<Outcome> outcomes = Collections.synchronizedList(new ArrayList<>());
    try {
      for (Callable<Object> task : tasks) {
        executor.submit(
            () -> {
              try {
                ready.await();
                outcomes.add(new Outcome(task.call(), null));
              } catch (Throwable t) {
                outcomes.add(new Outcome(null, t));
              } finally {
                done.countDown();
              }
            });
      }
      ready.countDown();
      if (!done.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        // 남은 스레드를 먼저 끊고 짧게 기다린 뒤, 원래 실패 메시지로 실패한다
        executor.shutdownNow();
        executor.awaitTermination(5, TimeUnit.SECONDS);
        fail("%d개 작업이 %d초 안에 끝나지 않았다 (데드락 의심)", n, TIMEOUT_SECONDS);
      }
      executor.shutdown();
      if (!executor.awaitTermination(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        fail("스레드 풀이 %d초 안에 종료되지 않았다", TIMEOUT_SECONDS);
      }
    } finally {
      // 어떤 경로로 빠져나가도 스레드를 남기지 않는다 (실패 메시지는 덮지 않는다)
      executor.shutdownNow();
    }
    assertThat(outcomes).as("끝난 작업 수").hasSize(n);
    return outcomes;
  }

  /** 예외를 타입 이름별로 센다. 예상 밖 타입이 섞이면 단언 메시지에 그대로 드러난다. */
  private Map<String, Integer> errorsByType(List<Outcome> outcomes) {
    Map<String, Integer> counts = new TreeMap<>();
    for (Outcome o : outcomes) {
      if (o.error() != null) {
        counts.merge(o.error().getClass().getName(), 1, Integer::sum);
        log.warn("스레드 예외", o.error());
      }
    }
    return counts;
  }

  // ---- DB 직접 조회 (영속성 컨텍스트 캐시 배제) ----

  private Integer countByStatus(Long sessionId, String status) {
    return jdbcTemplate.queryForObject(
        "SELECT COUNT(*) FROM enrollment WHERE session_id = ? AND status = ?",
        Integer.class,
        sessionId,
        status);
  }

  private Integer confirmedCount(Long sessionId) {
    return jdbcTemplate.queryForObject(
        "SELECT confirmed_count FROM course_session WHERE id = ?", Integer.class, sessionId);
  }
}
