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
  @DisplayName("complete()는 CANCELLED이면 IllegalStateException이다")
  void completeCancelledFails() {
    Enrollment e = Enrollment.confirmed(null, "E001", T0);
    ReflectionTestUtils.setField(e, "status", EnrollmentStatus.CANCELLED);

    assertThatThrownBy(e::complete).isInstanceOf(IllegalStateException.class);
    assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
  }
}
