package com.example.eduhub.enrollment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import com.example.eduhub.course.service.CourseSessionNotFoundException;
import com.example.eduhub.course.service.SessionLockService;
import com.example.eduhub.enrollment.domain.CompletionFailureReason;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.CompletionFailure;
import com.example.eduhub.enrollment.dto.CompletionResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

// 수료 처리 (FR-08, D-03, D-47, D-48). 개발 DB에 직접 연결하고 롤백한다 (D-15).
// 고정 시각은 2026-12-08 09:00이다.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Import({
  CompletionService.class,
  SessionLockService.class,
  EnrollmentService.class,
  CompletionServiceTest.FixedClockConfig.class
})
class CompletionServiceTest {

  private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
  private static final LocalDate TODAY = LocalDate.of(2026, 12, 8);
  private static final LocalDateTime T0 = LocalDateTime.of(2026, 12, 1, 9, 0);

  @TestConfiguration
  static class FixedClockConfig {
    @Bean
    Clock clock() {
      return Clock.fixed(TODAY.atTime(9, 0).atZone(ZONE).toInstant(), ZONE);
    }
  }

  @Autowired private CompletionService service;
  @Autowired private EnrollmentService enrollmentService;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository sessionRepository;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private EntityManager entityManager;

  private String suffix;
  private Course course;

  @BeforeEach
  void setUp() {
    suffix = UUID.randomUUID().toString().substring(0, 8);
    course = courseRepository.save(new Course("Spring 입문", "T-" + suffix, null));
  }

  private String emp(String prefix) {
    return prefix + suffix;
  }

  private CourseSession newSession(LocalDate startDate) {
    CourseSession s = sessionRepository.save(new CourseSession(course, startDate, "본사", 10));
    entityManager.flush();
    return s;
  }

  private Enrollment confirmed(CourseSession s, String employee) {
    s.occupySeat();
    return enrollmentRepository.saveAndFlush(Enrollment.confirmed(s, employee, T0));
  }

  private Enrollment waiting(CourseSession s, String employee, long key) {
    return enrollmentRepository.saveAndFlush(Enrollment.waiting(s, employee, T0, key));
  }

  /** 상태를 네이티브 SQL로 맞춘다 (CANCELLED·COMPLETED는 waiting_order가 null이어야 한다). */
  private void setStatus(Enrollment e, String status) {
    entityManager
        .createNativeQuery(
            "update enrollment set status = :status, waiting_order = null where id = :id")
        .setParameter("status", status)
        .setParameter("id", e.getId())
        .executeUpdate();
  }

  private CompletionResponse run(CourseSession s, String... ids) {
    entityManager.flush();
    entityManager.clear();
    CompletionResponse response = service.complete(s.getId(), List.of(ids));
    entityManager.flush();
    entityManager.clear();
    return response;
  }

  private Enrollment reload(Enrollment e) {
    return enrollmentRepository.findById(e.getId()).orElseThrow();
  }

  @Test
  @DisplayName("C1 확정 2명이 수료되고 순서가 입력 순서이며 confirmed_count는 그대로다 (D-48)")
  void completesConfirmed() {
    CourseSession s = newSession(TODAY);
    Enrollment a = confirmed(s, emp("A"));
    Enrollment b = confirmed(s, emp("B"));

    CompletionResponse r = run(s, emp("B"), emp("A"));

    assertThat(r.completed()).containsExactly(emp("B"), emp("A"));
    assertThat(r.failed()).isEmpty();
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
    assertThat(reload(b).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
    assertThat(sessionRepository.findById(s.getId()).orElseThrow().getConfirmedCount())
        .isEqualTo(2);
  }

  @Test
  @DisplayName("C2 대기자는 WAITING으로 실패하고 상태와 키가 유지된다 (D-03)")
  void waitingFails() {
    CourseSession s = newSession(TODAY);
    Enrollment w = waiting(s, emp("W"), 7L);

    CompletionResponse r = run(s, emp("W"));

    assertThat(r.completed()).isEmpty();
    assertThat(r.failed())
        .containsExactly(new CompletionFailure(emp("W"), CompletionFailureReason.WAITING));
    Enrollment after = reload(w);
    assertThat(after.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(after.getWaitingOrder()).isEqualTo(7L);
  }

  @Test
  @DisplayName("C3 신청이 없거나 취소만 있으면 NOT_ENROLLED다")
  void notEnrolled() {
    CourseSession s = newSession(TODAY);
    Enrollment c = confirmed(s, emp("C"));
    setStatus(c, "CANCELLED");

    CompletionResponse r = run(s, emp("C"), emp("N"));

    assertThat(r.completed()).isEmpty();
    assertThat(r.failed())
        .containsExactly(
            new CompletionFailure(emp("C"), CompletionFailureReason.NOT_ENROLLED),
            new CompletionFailure(emp("N"), CompletionFailureReason.NOT_ENROLLED));
    assertThat(reload(c).getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
  }

  @Test
  @DisplayName("C4 COMPLETED만 있으면 ALREADY_COMPLETED다")
  void alreadyCompleted() {
    CourseSession s = newSession(TODAY);
    Enrollment d = confirmed(s, emp("D"));
    setStatus(d, "COMPLETED");

    CompletionResponse r = run(s, emp("D"));

    assertThat(r.failed())
        .containsExactly(
            new CompletionFailure(emp("D"), CompletionFailureReason.ALREADY_COMPLETED));
    assertThat(reload(d).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("C5 확정·대기·없음이 섞이면 부분 성공하고 중복 사번은 한 번만 나온다")
  void mixedAndDuplicate() {
    CourseSession s = newSession(TODAY);
    Enrollment a = confirmed(s, emp("A"));
    waiting(s, emp("W"), 1L);

    CompletionResponse r = run(s, emp("A"), emp("W"), emp("A"), emp("N"), emp("W"));

    assertThat(r.completed()).containsExactly(emp("A"));
    assertThat(r.failed())
        .containsExactly(
            new CompletionFailure(emp("W"), CompletionFailureReason.WAITING),
            new CompletionFailure(emp("N"), CompletionFailureReason.NOT_ENROLLED));
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("C6 시작일이 내일이면 SessionNotStartedException이고 아무것도 바뀌지 않는다 (D-47)")
  void beforeStartDate() {
    CourseSession s = newSession(TODAY.plusDays(1));
    Enrollment a = confirmed(s, emp("A"));
    entityManager.flush();
    entityManager.clear();

    assertThatThrownBy(() -> service.complete(s.getId(), List.of(emp("A"))))
        .isInstanceOf(SessionNotStartedException.class);

    entityManager.flush();
    entityManager.clear();
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
  }

  @Test
  @DisplayName("C7 시작일 당일에는 수료된다 (D-47)")
  void onStartDate() {
    CourseSession s = newSession(TODAY);
    Enrollment a = confirmed(s, emp("A"));

    CompletionResponse r = run(s, emp("A"));

    assertThat(r.completed()).containsExactly(emp("A"));
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  // D-49 이후 API로는 생기지 않는 상태다. 이전 데이터 등 비정상 공존에 대한 방어를 확인한다.
  @Test
  @DisplayName("C8 D-49 이전 데이터 등 비정상 공존(COMPLETED+CONFIRMED)이면 CONFIRMED를 수료한다")
  void reEnrolled() {
    CourseSession s = newSession(TODAY);
    Enrollment old = confirmed(s, emp("A"));
    setStatus(old, "COMPLETED");
    Enrollment again = enrollmentRepository.saveAndFlush(Enrollment.confirmed(s, emp("A"), T0));

    CompletionResponse r = run(s, emp("A"));

    assertThat(r.completed()).containsExactly(emp("A"));
    assertThat(r.failed()).isEmpty();
    assertThat(reload(again).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("C16 수료 후 같은 회차에 재신청하면 DuplicateEnrollmentException이고 confirmed_count는 그대로다 (D-49)")
  void reEnrollAfterCompletionIsRejected() {
    CourseSession s = newSession(TODAY);
    confirmed(s, emp("A"));
    run(s, emp("A"));
    Long sessionId = s.getId();

    assertThatThrownBy(() -> enrollmentService.enroll(sessionId, emp("A")))
        .isInstanceOf(DuplicateEnrollmentException.class);

    entityManager.flush();
    entityManager.clear();
    assertThat(sessionRepository.findById(sessionId).orElseThrow().getConfirmedCount())
        .isEqualTo(1);
    assertThat(enrollmentRepository.findBySessionIdAndEmployeeIdIn(sessionId, List.of(emp("A"))))
        .hasSize(1);
  }

  // 전제: DB 콜레이션이 대소문자를 무시한다(_CI_). 이 테스트가 실패하면 먼저 콜레이션을 확인한다 (D-48)
  @Test
  @DisplayName("C12 신청은 대문자, 요청은 소문자여도 수료되고 응답에는 입력 원문을 쓴다 (D-48)")
  void caseInsensitive() {
    CourseSession s = newSession(TODAY);
    Enrollment a = confirmed(s, "AB" + suffix.toUpperCase());

    CompletionResponse r = run(s, "ab" + suffix.toLowerCase());

    assertThat(r.completed()).containsExactly("ab" + suffix.toLowerCase());
    assertThat(r.failed()).isEmpty();
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("C13 대소문자만 다른 같은 사번은 한 번만 처리하고 처음 입력 원문을 쓴다 (D-48)")
  void caseInsensitiveDuplicate() {
    CourseSession s = newSession(TODAY);
    confirmed(s, "AB" + suffix.toUpperCase());

    CompletionResponse r = run(s, "AB" + suffix.toUpperCase(), "ab" + suffix.toLowerCase());

    assertThat(r.completed()).containsExactly("AB" + suffix.toUpperCase());
    assertThat(r.failed()).isEmpty();
  }

  @Test
  @DisplayName("C14 같은 사번에 COMPLETED와 WAITING이 함께 있으면 WAITING이다")
  void completedAndWaiting() {
    CourseSession s = newSession(TODAY);
    Enrollment old = confirmed(s, emp("A"));
    setStatus(old, "COMPLETED");
    Enrollment w = waiting(s, emp("A"), 4L);

    CompletionResponse r = run(s, emp("A"));

    assertThat(r.completed()).isEmpty();
    assertThat(r.failed())
        .containsExactly(new CompletionFailure(emp("A"), CompletionFailureReason.WAITING));
    assertThat(reload(w).getStatus()).isEqualTo(EnrollmentStatus.WAITING);
  }

  @Test
  @DisplayName("C15 앞뒤 공백이 있는 사번은 trim되어 처리되고 응답에는 trim한 값을 쓴다")
  void trimmed() {
    CourseSession s = newSession(TODAY);
    Enrollment a = confirmed(s, emp("A"));

    CompletionResponse r = run(s, "  " + emp("A") + " ");

    assertThat(r.completed()).containsExactly(emp("A"));
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("C9 없는 회차는 CourseSessionNotFoundException이다")
  void sessionNotFound() {
    assertThatThrownBy(() -> service.complete(-1L, List.of(emp("A"))))
        .isInstanceOf(CourseSessionNotFoundException.class);
  }

  @Test
  @DisplayName("C10 employee 계정이 없는 사번도 확정 신청이 있으면 수료된다 (D-48)")
  void withoutAccount() {
    CourseSession s = newSession(TODAY);
    Enrollment a = confirmed(s, emp("NOACCT"));

    CompletionResponse r = run(s, emp("NOACCT"));

    assertThat(r.completed()).containsExactly(emp("NOACCT"));
    assertThat(reload(a).getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }
}
