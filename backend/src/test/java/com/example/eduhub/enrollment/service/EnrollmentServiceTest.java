package com.example.eduhub.enrollment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.service.CourseSessionNotFoundException;
import com.example.eduhub.course.service.SessionLockService;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

  private static final Long SESSION_ID = 3L;
  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-11-12T01:15:30Z"), ZoneOffset.UTC);

  @Mock SessionLockService sessionLockService;
  @Mock EnrollmentRepository enrollmentRepository;

  EnrollmentService service;

  @BeforeEach
  void setUp() {
    service = new EnrollmentService(sessionLockService, enrollmentRepository, CLOCK);
  }

  private CourseSession session(int capacity) {
    CourseSession s = new CourseSession(null, LocalDate.of(2026, 12, 1), "A동", capacity);
    ReflectionTestUtils.setField(s, "id", SESSION_ID);
    when(sessionLockService.lock(SESSION_ID)).thenReturn(s);
    return s;
  }

  private void stubNoDuplicate() {
    when(enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
            eq(SESSION_ID), any(), anyCollection()))
        .thenReturn(false);
  }

  private void stubWaiting(boolean exists) {
    when(enrollmentRepository.existsBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(exists);
  }

  private void stubSave() {
    when(enrollmentRepository.saveAndFlush(any(Enrollment.class)))
        .thenAnswer(i -> i.getArgument(0));
  }

  @Test
  void s1_남은_자리가_있고_대기가_없으면_확정() {
    CourseSession s = session(2);
    stubNoDuplicate();
    stubWaiting(false);
    stubSave();

    EnrollmentResponse r = service.enroll(SESSION_ID, "E1");

    assertThat(r.status()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(r.sessionId()).isEqualTo(SESSION_ID);
    assertThat(s.getConfirmedCount()).isEqualTo(1);
  }

  @Test
  void s2_남은_자리가_없으면_대기() {
    CourseSession s = session(1);
    s.occupySeat();
    stubNoDuplicate();
    stubSave();

    EnrollmentResponse r = service.enroll(SESSION_ID, "E1");

    assertThat(r.status()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(s.getConfirmedCount()).isEqualTo(1);
    org.mockito.ArgumentCaptor<Enrollment> captor =
        org.mockito.ArgumentCaptor.forClass(Enrollment.class);
    verify(enrollmentRepository).saveAndFlush(captor.capture());
    assertThat(captor.getValue().getWaitingOrder()).isNull();
  }

  @Test
  void s3_자리가_있어도_대기자가_있으면_대기() {
    CourseSession s = session(2);
    stubNoDuplicate();
    stubWaiting(true);
    stubSave();

    EnrollmentResponse r = service.enroll(SESSION_ID, "E1");

    assertThat(r.status()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(s.getConfirmedCount()).isZero();
  }

  @Test
  void s4_마감_회차는_예외() {
    CourseSession s = session(2);
    s.close();

    assertThatThrownBy(() -> service.enroll(SESSION_ID, "E1"))
        .isInstanceOf(SessionClosedException.class);
    verify(enrollmentRepository, never()).saveAndFlush(any());
  }

  @Test
  void s5_이미_신청했으면_예외() {
    session(2);
    when(enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
            eq(SESSION_ID), eq("E1"), anyCollection()))
        .thenReturn(true);

    assertThatThrownBy(() -> service.enroll(SESSION_ID, "E1"))
        .isInstanceOf(DuplicateEnrollmentException.class);
    verify(enrollmentRepository, never()).saveAndFlush(any());
  }

  @Test
  void s6_회차가_없으면_예외() {
    when(sessionLockService.lock(SESSION_ID))
        .thenThrow(new CourseSessionNotFoundException(SESSION_ID));

    assertThatThrownBy(() -> service.enroll(SESSION_ID, "E1"))
        .isInstanceOf(CourseSessionNotFoundException.class);
    verify(enrollmentRepository, never()).saveAndFlush(any());
  }

  @Test
  void s7_활성_유일_인덱스_위반은_중복_예외() {
    session(2);
    stubNoDuplicate();
    stubWaiting(false);
    when(enrollmentRepository.saveAndFlush(any()))
        .thenThrow(
            new DataIntegrityViolationException(
                "x",
                new RuntimeException("Cannot insert duplicate key ... 'ux_enrollment_active'")));

    assertThatThrownBy(() -> service.enroll(SESSION_ID, "E1"))
        .isInstanceOf(DuplicateEnrollmentException.class);
  }

  @Test
  void s7_다른_제약_위반은_원래_예외를_그대로_던진다() {
    session(2);
    stubNoDuplicate();
    stubWaiting(false);
    DataIntegrityViolationException original =
        new DataIntegrityViolationException(
            "x", new RuntimeException("conflicted with CHECK constraint 'ck_enrollment_status'"));
    when(enrollmentRepository.saveAndFlush(any())).thenThrow(original);

    assertThatThrownBy(() -> service.enroll(SESSION_ID, "E1")).isSameAs(original);
  }

  @Test
  void s8_사번_앞뒤_공백은_제거() {
    session(2);
    when(enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
            eq(SESSION_ID),
            eq("E1"),
            eq(List.of(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING))))
        .thenReturn(false);
    stubWaiting(false);
    stubSave();

    EnrollmentResponse r = service.enroll(SESSION_ID, " E1 ");

    assertThat(r.employeeId()).isEqualTo("E1");
  }

  @Test
  void s9_신청_시각은_고정_Clock() {
    session(2);
    stubNoDuplicate();
    stubWaiting(false);
    stubSave();

    EnrollmentResponse r = service.enroll(SESSION_ID, "E1");

    assertThat(r.appliedAt()).isEqualTo(LocalDateTime.of(2026, 11, 12, 1, 15, 30));
  }
}
