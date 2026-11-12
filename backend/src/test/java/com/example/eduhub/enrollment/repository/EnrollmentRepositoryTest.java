package com.example.eduhub.enrollment.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

// 신청 제약 (FR-04, D-07, D-39). 개발 DB에 직접 연결하고 롤백한다 (D-15).
// 네이티브 SQL은 EntityManager로 실행해 같은 트랜잭션(롤백 대상)에 참여시킨다
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class EnrollmentRepositoryTest {

  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 9, 0);

  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository sessionRepository;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private EntityManager entityManager;

  private CourseSession session;
  private String employeeA;
  private String employeeB;

  @BeforeEach
  void setUp() {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    Course course = courseRepository.save(new Course("Spring 입문", "T-" + suffix, null));
    session = sessionRepository.save(new CourseSession(course, LocalDate.of(2026, 12, 8), "본사", 2));
    employeeA = "A" + suffix;
    employeeB = "B" + suffix;
    entityManager.flush();
  }

  private void insertCancelled(String employeeId) {
    entityManager
        .createNativeQuery(
            "insert into enrollment (session_id, employee_id, status, applied_at)"
                + " values (:sessionId, :employeeId, 'CANCELLED', :appliedAt)")
        .setParameter("sessionId", session.getId())
        .setParameter("employeeId", employeeId)
        .setParameter("appliedAt", NOW)
        .executeUpdate();
  }

  @Test
  @DisplayName("R1 같은 회차·사번의 WAITING 중복 저장은 유일 인덱스로 거부된다")
  void duplicateActiveRejected() {
    enrollmentRepository.saveAndFlush(Enrollment.waiting(session, employeeA, NOW));

    assertThatThrownBy(
            () -> enrollmentRepository.saveAndFlush(Enrollment.waiting(session, employeeA, NOW)))
        .isInstanceOf(DataIntegrityViolationException.class)
        .rootCause()
        .hasMessageContaining("ux_enrollment_active");
  }

  @Test
  @DisplayName("R2 취소된 신청이 있어도 같은 사번이 다시 신청할 수 있다 (D-07)")
  void reapplyAfterCancel() {
    insertCancelled(employeeA);

    Enrollment saved =
        enrollmentRepository.saveAndFlush(Enrollment.confirmed(session, employeeA, NOW));

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
  }

  @Test
  @DisplayName("R3 서로 다른 사번의 WAITING 두 행은 waiting_order가 모두 NULL이어도 저장된다")
  void twoWaitingWithNullOrder() {
    Enrollment a = enrollmentRepository.save(Enrollment.waiting(session, employeeA, NOW));
    Enrollment b = enrollmentRepository.save(Enrollment.waiting(session, employeeB, NOW));
    entityManager.flush();
    entityManager.clear();

    // 엔티티 값이 아니라 DB에 저장된 값을 다시 읽어 확인한다
    assertThat(enrollmentRepository.findById(a.getId()))
        .get()
        .extracting(Enrollment::getWaitingOrder)
        .isNull();
    assertThat(enrollmentRepository.findById(b.getId()))
        .get()
        .extracting(Enrollment::getWaitingOrder)
        .isNull();
    Number nullCount =
        (Number)
            entityManager
                .createNativeQuery(
                    "select count(*) from enrollment"
                        + " where session_id = :sessionId and waiting_order is null")
                .setParameter("sessionId", session.getId())
                .getSingleResult();
    assertThat(nullCount.intValue()).isEqualTo(2);
  }

  @Test
  @DisplayName("R4 CONFIRMED 행에 waiting_order를 넣으면 CHECK 제약으로 거부된다")
  void confirmedWithWaitingOrderRejected() {
    Enrollment saved =
        enrollmentRepository.saveAndFlush(Enrollment.confirmed(session, employeeA, NOW));

    assertThatThrownBy(
            () ->
                entityManager
                    .createNativeQuery("update enrollment set waiting_order = 1 where id = :id")
                    .setParameter("id", saved.getId())
                    .executeUpdate())
        .isInstanceOfAny(PersistenceException.class, DataIntegrityViolationException.class)
        .rootCause()
        .hasMessageContaining("ck_enrollment_waiting_order");
  }

  @Test
  @DisplayName("R5 confirmed_count가 정원을 넘으면 CHECK 제약으로 거부된다")
  void confirmedCountOverCapacityRejected() {
    assertThatThrownBy(
            () ->
                entityManager
                    .createNativeQuery(
                        "update course_session set confirmed_count = 3 where id = :id")
                    .setParameter("id", session.getId())
                    .executeUpdate())
        .isInstanceOfAny(PersistenceException.class, DataIntegrityViolationException.class)
        .rootCause()
        .hasMessageContaining("ck_course_session_confirmed_count");
  }

  @Test
  @DisplayName("R6 exists 조회가 상태·사번·회차에 맞게 참과 거짓을 돌려준다")
  void existsQueries() {
    enrollmentRepository.saveAndFlush(Enrollment.confirmed(session, employeeA, NOW));
    List<EnrollmentStatus> active = List.of(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING);

    assertThat(
            enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
                session.getId(), employeeA, active))
        .isTrue();
    assertThat(
            enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
                session.getId(), employeeB, active))
        .isFalse();
    assertThat(
            enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
                session.getId(), employeeA, List.of(EnrollmentStatus.WAITING)))
        .isFalse();
    assertThat(
            enrollmentRepository.existsBySessionIdAndStatus(
                session.getId(), EnrollmentStatus.CONFIRMED))
        .isTrue();
    assertThat(
            enrollmentRepository.existsBySessionIdAndStatus(
                session.getId(), EnrollmentStatus.WAITING))
        .isFalse();
  }
}
