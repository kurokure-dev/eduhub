package com.example.eduhub.enrollment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.service.SessionLockService;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

// 신청 취소와 승급 (FR-06, D-01, D-02, D-45, D-52)
@ExtendWith(MockitoExtension.class)
class EnrollmentCancelServiceTest {

  private static final Long SESSION_ID = 3L;
  private static final Long ENROLLMENT_ID = 7L;
  private static final LocalDateTime T0 = LocalDateTime.of(2026, 11, 12, 9, 0);

  @Mock SessionLockService sessionLockService;
  @Mock EnrollmentRepository enrollmentRepository;

  private CourseSession session(int capacity, int confirmed) {
    CourseSession s = new CourseSession(null, LocalDate.of(2026, 12, 1), "A동", capacity);
    ReflectionTestUtils.setField(s, "id", SESSION_ID);
    for (int i = 0; i < confirmed; i++) {
      s.occupySeat();
    }
    when(sessionLockService.lock(SESSION_ID)).thenReturn(s);
    return s;
  }

  private EnrollmentCancelService service() {
    return new EnrollmentCancelService(sessionLockService, enrollmentRepository);
  }

  private void stubOwn(Enrollment e) {
    ReflectionTestUtils.setField(e, "id", ENROLLMENT_ID);
    when(enrollmentRepository.findSessionIdByIdAndEmployeeId(ENROLLMENT_ID, "E1"))
        .thenReturn(Optional.of(SESSION_ID));
    when(enrollmentRepository.findById(ENROLLMENT_ID)).thenReturn(Optional.of(e));
  }

  private Enrollment withSession(Enrollment e, CourseSession s) {
    ReflectionTestUtils.setField(e, "session", s);
    return e;
  }

  @Test
  @DisplayName("확정 취소는 자리를 비우고 대기 1순위를 승급한다 (D-01, D-52)")
  void confirmedCancelPromotesFirstWaiting() {
    CourseSession s = session(2, 2);
    Enrollment mine = withSession(Enrollment.confirmed(s, "E1", T0), s);
    Enrollment next = Enrollment.waiting(s, "E2", T0, 4L);
    stubOwn(mine);
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByWaitingOrderAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.of(next));

    EnrollmentResponse r = service().cancel(ENROLLMENT_ID, "E1");

    assertThat(r.status()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(r.waitingRank()).isNull();
    assertThat(mine.getWaitingOrder()).isNull();
    assertThat(next.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(next.getWaitingOrder()).isNull();
    assertThat(s.getConfirmedCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("확정 취소 때 대기자가 없으면 자리만 비운다")
  void confirmedCancelWithoutWaiting() {
    CourseSession s = session(2, 2);
    stubOwn(withSession(Enrollment.confirmed(s, "E1", T0), s));
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByWaitingOrderAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.empty());

    service().cancel(ENROLLMENT_ID, "E1");

    assertThat(s.getConfirmedCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("대기 취소는 확정 인원을 바꾸지 않고 승급도 하지 않는다 (D-01)")
  void waitingCancelKeepsConfirmedCount() {
    CourseSession s = session(2, 2);
    Enrollment mine = withSession(Enrollment.waiting(s, "E1", T0, 2L), s);
    stubOwn(mine);

    EnrollmentResponse r = service().cancel(ENROLLMENT_ID, "E1");

    assertThat(r.status()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(mine.getWaitingOrder()).isNull();
    assertThat(s.getConfirmedCount()).isEqualTo(2);
    verify(enrollmentRepository, never())
        .findFirstBySessionIdAndStatusOrderByWaitingOrderAsc(SESSION_ID, EnrollmentStatus.WAITING);
  }

  @Test
  @DisplayName("회차 id 조회는 락 앞, 신청 로드는 락 뒤에 일어난다 (NFR-01)")
  void lockOrder() {
    CourseSession s = session(2, 1);
    stubOwn(withSession(Enrollment.confirmed(s, "E1", T0), s));
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByWaitingOrderAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.empty());

    service().cancel(ENROLLMENT_ID, "E1");

    InOrder order = inOrder(enrollmentRepository, sessionLockService);
    order.verify(enrollmentRepository).findSessionIdByIdAndEmployeeId(ENROLLMENT_ID, "E1");
    order.verify(sessionLockService).lock(SESSION_ID);
    order.verify(enrollmentRepository).findById(ENROLLMENT_ID);
  }

  @Test
  @DisplayName("수료한 신청은 409다 (D-52)")
  void completedIs409() {
    CourseSession s = session(2, 1);
    Enrollment e = withSession(Enrollment.confirmed(s, "E1", T0), s);
    e.complete();
    stubOwn(e);

    assertThatThrownBy(() -> service().cancel(ENROLLMENT_ID, "E1"))
        .isInstanceOf(EnrollmentNotCancellableException.class);
    assertThat(s.getConfirmedCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("이미 취소한 신청은 409다 (D-52)")
  void alreadyCancelledIs409() {
    CourseSession s = session(2, 0);
    Enrollment e = withSession(Enrollment.confirmed(s, "E1", T0), s);
    e.cancel();
    stubOwn(e);

    assertThatThrownBy(() -> service().cancel(ENROLLMENT_ID, "E1"))
        .isInstanceOf(EnrollmentNotCancellableException.class);
    assertThat(s.getConfirmedCount()).isZero();
  }

  @Test
  @DisplayName("마감된 회차는 409이고 신청을 읽지도 않는다 (D-02)")
  void closedSessionIs409() {
    CourseSession s = session(2, 1);
    s.close();
    when(enrollmentRepository.findSessionIdByIdAndEmployeeId(ENROLLMENT_ID, "E1"))
        .thenReturn(Optional.of(SESSION_ID));

    assertThatThrownBy(() -> service().cancel(ENROLLMENT_ID, "E1"))
        .isInstanceOf(SessionClosedException.class);
    verify(enrollmentRepository, never()).findById(ENROLLMENT_ID);
    assertThat(s.getConfirmedCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("남의 신청이나 없는 신청은 404이고 락도 잡지 않는다 (D-45)")
  void othersEnrollmentIs404() {
    when(enrollmentRepository.findSessionIdByIdAndEmployeeId(ENROLLMENT_ID, "E9"))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().cancel(ENROLLMENT_ID, "E9"))
        .isInstanceOf(EnrollmentNotFoundException.class);
    verify(sessionLockService, never()).lock(SESSION_ID);
  }
}
