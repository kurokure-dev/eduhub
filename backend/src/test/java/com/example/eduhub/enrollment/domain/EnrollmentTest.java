package com.example.eduhub.enrollment.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

// 수료 처리 도메인 규칙 (FR-08, D-03, D-48)
class EnrollmentTest {

  private static final LocalDateTime T0 = LocalDateTime.of(2026, 12, 1, 9, 0);

  @Test
  @DisplayName("complete()는 CONFIRMED를 COMPLETED로 바꾼다 (D-03)")
  void completeConfirmed() {
    Enrollment e = Enrollment.confirmed(null, "E001", T0);

    e.complete();

    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("complete()는 WAITING이면 IllegalStateException이고 상태·키가 그대로다 (D-03)")
  void completeWaitingFails() {
    Enrollment e = Enrollment.waiting(null, "E001", T0, 3L);

    assertThatThrownBy(e::complete).isInstanceOf(IllegalStateException.class);
    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(e.getWaitingOrder()).isEqualTo(3L);
  }

  @Test
  @DisplayName("complete()는 이미 COMPLETED이면 IllegalStateException이다")
  void completeCompletedFails() {
    Enrollment e = Enrollment.confirmed(null, "E001", T0);
    e.complete();

    assertThatThrownBy(e::complete).isInstanceOf(IllegalStateException.class);
    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("cancel()은 CONFIRMED를 CANCELLED로 바꾼다 (D-51)")
  void cancelConfirmed() {
    Enrollment e = Enrollment.confirmed(null, "E001", T0);

    e.cancel();

    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(e.getWaitingOrder()).isNull();
  }

  @Test
  @DisplayName("cancel()은 WAITING을 CANCELLED로 바꾸고 대기 키를 비운다 (D-46, D-51)")
  void cancelWaitingClearsOrder() {
    Enrollment e = Enrollment.waiting(null, "E001", T0, 3L);

    e.cancel();

    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(e.getWaitingOrder()).isNull();
  }

  @Test
  @DisplayName("cancel()은 COMPLETED·CANCELLED이면 IllegalStateException이다 (D-51)")
  void cancelNotAllowedStatuses() {
    Enrollment completed = Enrollment.confirmed(null, "E001", T0);
    completed.complete();
    Enrollment cancelled = Enrollment.confirmed(null, "E002", T0);
    cancelled.cancel();

    assertThatThrownBy(completed::cancel).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(cancelled::cancel).isInstanceOf(IllegalStateException.class);
    assertThat(completed.getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  @DisplayName("promote()는 WAITING을 CONFIRMED로 바꾸고 대기 키를 비운다 (D-01, D-46)")
  void promoteWaiting() {
    Enrollment e = Enrollment.waiting(null, "E001", T0, 3L);

    e.promote();

    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(e.getWaitingOrder()).isNull();
  }

  @Test
  @DisplayName("promote()는 대기가 아니면 IllegalStateException이다")
  void promoteNonWaitingFails() {
    Enrollment e = Enrollment.confirmed(null, "E001", T0);

    assertThatThrownBy(e::promote).isInstanceOf(IllegalStateException.class);
    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
  }

  @Test
  @DisplayName("complete()는 CANCELLED이면 IllegalStateException이다")
  void completeCancelledFails() {
    Enrollment e = Enrollment.confirmed(null, "E001", T0);
    ReflectionTestUtils.setField(e, "status", EnrollmentStatus.CANCELLED);

    assertThatThrownBy(e::complete).isInstanceOf(IllegalStateException.class);
    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
  }
}
