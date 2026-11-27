package com.example.eduhub.enrollment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.repository.EmployeeRepository;
import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import com.example.eduhub.course.service.CourseSessionNotFoundException;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.RosterConfirmedEntry;
import com.example.eduhub.enrollment.dto.RosterResponse;
import com.example.eduhub.enrollment.dto.RosterWaitingEntry;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

// 회차 명단 조회 (FR-08, D-39, D-48). 개발 DB에 직접 연결하고 롤백한다 (D-15).
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Import(RosterService.class)
class RosterServiceTest {

  private static final LocalDateTime T0 = LocalDateTime.of(2026, 12, 1, 9, 0);

  @Autowired private RosterService service;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository sessionRepository;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private EntityManager entityManager;

  private String suffix;
  private Course course;
  private CourseSession session;

  @BeforeEach
  void setUp() {
    suffix = UUID.randomUUID().toString().substring(0, 8);
    course = courseRepository.save(new Course("Spring 입문", "T-" + suffix, null));
    session = newSession();
  }

  private CourseSession newSession() {
    CourseSession s =
        sessionRepository.save(new CourseSession(course, LocalDate.of(2026, 12, 8), "본사", 10));
    entityManager.flush();
    return s;
  }

  private String emp(String prefix) {
    return prefix + suffix;
  }

  /** 계정을 만든다. 이름은 "이름-사번"이다. */
  private void account(String employeeNo) {
    employeeRepository.saveAndFlush(
        new Employee(employeeNo, "이름-" + employeeNo, "dummy-hash", Role.EMPLOYEE));
  }

  private Enrollment confirmed(CourseSession s, String employee, LocalDateTime at) {
    return enrollmentRepository.saveAndFlush(Enrollment.confirmed(s, employee, at));
  }

  private Enrollment waiting(CourseSession s, String employee, LocalDateTime at, long key) {
    return enrollmentRepository.saveAndFlush(Enrollment.waiting(s, employee, at, key));
  }

  private void setStatus(Enrollment e, String status) {
    entityManager
        .createNativeQuery(
            "update enrollment set status = :status, waiting_order = null where id = :id")
        .setParameter("status", status)
        .setParameter("id", e.getId())
        .executeUpdate();
  }

  private RosterResponse roster(CourseSession s) {
    entityManager.flush();
    entityManager.clear();
    return service.getRoster(s.getId());
  }

  @Test
  @DisplayName("R1 회차 요약이 맞다")
  void summary() {
    RosterResponse r = roster(session);

    assertThat(r.sessionId()).isEqualTo(session.getId());
    assertThat(r.courseTitle()).isEqualTo("Spring 입문");
    assertThat(r.sessionStartDate()).isEqualTo(LocalDate.of(2026, 12, 8));
    assertThat(r.capacity()).isEqualTo(10);
    assertThat(r.sessionStatus()).isEqualTo(CourseSessionStatus.OPEN);
  }

  @Test
  @DisplayName("R2 확정·수료는 신청순이고 대기는 키순에 순번 1·2·3이다 (D-39)")
  void orderingAndRank() {
    for (String p : new String[] {"A", "B", "W1", "W2", "W3"}) {
      account(emp(p));
    }
    Enrollment b = confirmed(session, emp("B"), T0.plusMinutes(5));
    confirmed(session, emp("A"), T0);
    setStatus(b, "COMPLETED");
    // 신청 시각과 키 순서가 다르다 (D-12 강등자 모양)
    waiting(session, emp("W1"), T0.plusMinutes(1), 30L);
    waiting(session, emp("W2"), T0.plusMinutes(2), 10L);
    waiting(session, emp("W3"), T0.plusMinutes(3), 20L);

    RosterResponse r = roster(session);

    assertThat(r.confirmed())
        .extracting(RosterConfirmedEntry::employeeNo, RosterConfirmedEntry::status)
        .containsExactly(
            tuple(emp("A"), EnrollmentStatus.CONFIRMED),
            tuple(emp("B"), EnrollmentStatus.COMPLETED));
    assertThat(r.waiting())
        .extracting(RosterWaitingEntry::employeeNo, RosterWaitingEntry::waitingRank)
        .containsExactly(tuple(emp("W2"), 1L), tuple(emp("W3"), 2L), tuple(emp("W1"), 3L));
  }

  @Test
  @DisplayName("R3 취소 행과 다른 회차의 신청은 나오지 않는다")
  void excludesCancelledAndOtherSession() {
    account(emp("A"));
    account(emp("C"));
    account(emp("O"));
    confirmed(session, emp("A"), T0);
    setStatus(confirmed(session, emp("C"), T0.plusMinutes(1)), "CANCELLED");
    confirmed(newSession(), emp("O"), T0);

    RosterResponse r = roster(session);

    assertThat(r.confirmed())
        .extracting(RosterConfirmedEntry::employeeNo)
        .containsExactly(emp("A"));
    assertThat(r.waiting()).isEmpty();
  }

  @Test
  @DisplayName("R4 계정 없는 사번은 빠지되 대기 순번은 빼기 전 기준이다 (D-48)")
  void withoutAccountKeepsRank() {
    account(emp("A"));
    account(emp("W2"));
    account(emp("W3"));
    confirmed(session, emp("A"), T0);
    confirmed(session, emp("NOACCT"), T0.plusMinutes(1));
    waiting(session, emp("W1"), T0.plusMinutes(2), 1L); // 계정 없음, 대기 1번
    waiting(session, emp("W2"), T0.plusMinutes(3), 2L);
    waiting(session, emp("W3"), T0.plusMinutes(4), 3L);

    RosterResponse r = roster(session);

    assertThat(r.confirmed())
        .extracting(RosterConfirmedEntry::employeeNo)
        .containsExactly(emp("A"));
    assertThat(r.waiting())
        .extracting(RosterWaitingEntry::employeeNo, RosterWaitingEntry::waitingRank)
        .containsExactly(tuple(emp("W2"), 2L), tuple(emp("W3"), 3L));
  }

  @Test
  @DisplayName("R5 이름이 employee 테이블 값이다")
  void nameFromEmployee() {
    account(emp("A"));
    confirmed(session, emp("A"), T0);

    RosterResponse r = roster(session);

    assertThat(r.confirmed())
        .extracting(RosterConfirmedEntry::name)
        .containsExactly("이름-" + emp("A"));
  }

  @Test
  @DisplayName("R6 없는 회차는 CourseSessionNotFoundException이다")
  void sessionNotFound() {
    assertThatThrownBy(() -> service.getRoster(-1L))
        .isInstanceOf(CourseSessionNotFoundException.class);
  }

  @Test
  @DisplayName("R7 신청이 없으면 두 목록 모두 비어 있다")
  void empty() {
    RosterResponse r = roster(session);

    assertThat(r.confirmed()).isEmpty();
    assertThat(r.waiting()).isEmpty();
  }
}
