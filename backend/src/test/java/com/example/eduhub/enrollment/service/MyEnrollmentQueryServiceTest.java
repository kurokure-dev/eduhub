package com.example.eduhub.enrollment.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.MyEnrollmentResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

// 내 신청 내역 조회 (FR-07, D-09, D-39). 개발 DB에 직접 연결하고 롤백한다 (D-15).
// 네이티브 SQL은 EntityManager로 실행해 같은 트랜잭션(롤백 대상)에 참여시킨다
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Import(MyEnrollmentQueryService.class)
class MyEnrollmentQueryServiceTest {

  private static final LocalDateTime T0 = LocalDateTime.of(2026, 11, 12, 9, 0);

  @Autowired private MyEnrollmentQueryService service;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository sessionRepository;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private EntityManager entityManager;

  private String suffix;
  private Course course;
  private CourseSession session;

  @BeforeEach
  void setUp() {
    suffix = UUID.randomUUID().toString().substring(0, 8);
    course = courseRepository.save(new Course("Spring 입문", "T-" + suffix, null));
    session = newSession(LocalDate.of(2026, 12, 8), "본사");
  }

  private CourseSession newSession(LocalDate startDate, String place) {
    CourseSession s = sessionRepository.save(new CourseSession(course, startDate, place, 10));
    entityManager.flush();
    return s;
  }

  private String emp(String prefix) {
    return prefix + suffix;
  }

  private Enrollment confirmed(CourseSession s, String employee, LocalDateTime at) {
    return enrollmentRepository.saveAndFlush(Enrollment.confirmed(s, employee, at));
  }

  private Enrollment waiting(CourseSession s, String employee, LocalDateTime at, long key) {
    return enrollmentRepository.saveAndFlush(Enrollment.waiting(s, employee, at, key));
  }

  private void cancelNative(Long id) {
    entityManager
        .createNativeQuery(
            "update enrollment set status = 'CANCELLED', waiting_order = null where id = :id")
        .setParameter("id", id)
        .executeUpdate();
  }

  @Test
  @DisplayName("M1 내 신청만 나온다")
  void onlyMine() {
    confirmed(session, emp("A"), T0);
    confirmed(session, emp("B"), T0.plusMinutes(1));
    confirmed(newSession(LocalDate.of(2026, 12, 9), "지사"), emp("B"), T0);

    List<MyEnrollmentResponse> result = service.findMine(emp("A"), null);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).sessionId()).isEqualTo(session.getId());
  }

  @Test
  @DisplayName("M2 상태 필터와 최근 신청순(같은 시각이면 id 내림차순) 정렬")
  void filterAndOrder() {
    CourseSession s2 = newSession(LocalDate.of(2026, 12, 9), "지사");
    CourseSession s3 = newSession(LocalDate.of(2026, 12, 10), "분당");
    String a = emp("A");
    Enrollment old = confirmed(session, a, T0);
    Enrollment waitingSame = waiting(s2, a, T0.plusDays(1), 1L);
    Enrollment confirmedSame = confirmed(s3, a, T0.plusDays(1));

    assertThat(service.findMine(a, null))
        .extracting(MyEnrollmentResponse::enrollmentId)
        .containsExactly(confirmedSame.getId(), waitingSame.getId(), old.getId());
    assertThat(service.findMine(a, EnrollmentStatus.WAITING))
        .extracting(MyEnrollmentResponse::enrollmentId)
        .containsExactly(waitingSame.getId());
    assertThat(service.findMine(a, EnrollmentStatus.CANCELLED)).isEmpty();
  }

  @Test
  @DisplayName("M3 과정 제목, 회차 ID, 시작일, 장소, 상태, 신청 일시가 맞다")
  void fields() {
    Enrollment e = confirmed(session, emp("A"), T0);

    MyEnrollmentResponse r = service.findMine(emp("A"), null).get(0);

    assertThat(r.enrollmentId()).isEqualTo(e.getId());
    assertThat(r.sessionId()).isEqualTo(session.getId());
    assertThat(r.courseTitle()).isEqualTo("Spring 입문");
    assertThat(r.sessionStartDate()).isEqualTo(LocalDate.of(2026, 12, 8));
    assertThat(r.sessionPlace()).isEqualTo("본사");
    assertThat(r.status()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(r.appliedAt()).isEqualTo(T0);
  }

  @Test
  @DisplayName("M4 대기 순번은 키 순서대로 1·2·3이고 확정 행은 null이다 (D-09, D-39)")
  void waitingRank() {
    confirmed(session, emp("A"), T0);
    waiting(session, emp("B"), T0.plusMinutes(1), 1L);
    waiting(session, emp("C"), T0.plusMinutes(2), 2L);
    waiting(session, emp("D"), T0.plusMinutes(3), 3L);

    assertThat(service.findMine(emp("A"), null).get(0).waitingRank()).isNull();
    assertThat(service.findMine(emp("B"), null).get(0).waitingRank()).isEqualTo(1L);
    assertThat(service.findMine(emp("C"), null).get(0).waitingRank()).isEqualTo(2L);
    assertThat(service.findMine(emp("D"), null).get(0).waitingRank()).isEqualTo(3L);
  }

  @Test
  @DisplayName("M4b 키가 신청 시각과 달라도 키 순서로 순번이 정해진다 (D-12)")
  void rankFollowsKeyNotAppliedAt() {
    waiting(session, emp("B"), T0, 5L);
    waiting(session, emp("C"), T0.plusMinutes(1), 2L);

    assertThat(service.findMine(emp("C"), null).get(0).waitingRank()).isEqualTo(1L);
    assertThat(service.findMine(emp("B"), null).get(0).waitingRank()).isEqualTo(2L);
  }

  @Test
  @DisplayName("M5 앞 대기자가 취소되면 뒷순번이 당겨진다 (D-01)")
  void rankMovesUp() {
    Enrollment first = waiting(session, emp("B"), T0.plusMinutes(1), 1L);
    waiting(session, emp("C"), T0.plusMinutes(2), 2L);
    waiting(session, emp("D"), T0.plusMinutes(3), 3L);

    cancelNative(first.getId());
    entityManager.flush();
    entityManager.clear();

    MyEnrollmentResponse cancelled = service.findMine(emp("B"), null).get(0);
    assertThat(cancelled.status()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(cancelled.waitingRank()).isNull();
    assertThat(service.findMine(emp("C"), null).get(0).waitingRank()).isEqualTo(1L);
    assertThat(service.findMine(emp("D"), null).get(0).waitingRank()).isEqualTo(2L);
  }

  @Test
  @DisplayName("M6 다른 회차의 대기자는 내 순번에 영향을 주지 않는다")
  void rankIsPerSession() {
    CourseSession other = newSession(LocalDate.of(2026, 12, 9), "지사");
    waiting(other, emp("X"), T0, 1L);
    waiting(other, emp("Y"), T0, 2L);
    waiting(session, emp("B"), T0, 3L);

    assertThat(service.findMine(emp("B"), null).get(0).waitingRank()).isEqualTo(1L);
  }

  @Test
  @DisplayName("M7 회차 여러 개여도 SQL은 1개다 (NFR-02)")
  void singleStatement() {
    String a = emp("A");
    confirmed(session, a, T0);
    waiting(newSession(LocalDate.of(2026, 12, 9), "지사"), a, T0.plusMinutes(1), 1L);
    waiting(newSession(LocalDate.of(2026, 12, 10), "분당"), a, T0.plusMinutes(2), 1L);
    entityManager.flush();
    entityManager.clear();
    Statistics statistics =
        entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
    statistics.clear();

    List<MyEnrollmentResponse> result = service.findMine(a, null);

    assertThat(result).hasSize(3);
    assertThat(result)
        .extracting(MyEnrollmentResponse::waitingRank)
        .containsExactlyInAnyOrder(null, 1L, 1L);
    assertThat(statistics.getPrepareStatementCount()).isEqualTo(1L);
  }

  @Test
  @DisplayName("M8 신청이 없으면 빈 목록이다")
  void empty() {
    assertThat(service.findMine(emp("Z"), null)).isEmpty();
  }
}
