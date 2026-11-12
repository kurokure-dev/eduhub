package com.example.eduhub.course.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CourseSessionTest {

  private static CourseSession session(int capacity) {
    return new CourseSession(
        new Course("Spring 입문", "개발", null), LocalDate.of(2026, 12, 1), "본사", capacity);
  }

  @Test
  @DisplayName("E1 occupySeat는 정원까지 확정 인원을 늘리고, 넘으면 예외다 (D-37)")
  void occupySeatUpToCapacity() {
    CourseSession session = session(2);

    session.occupySeat();
    session.occupySeat();

    assertThat(session.getConfirmedCount()).isEqualTo(2);
    assertThat(session.hasRemainingSeat()).isFalse();
    assertThatThrownBy(session::occupySeat).isInstanceOf(CourseStateException.class);
    assertThat(session.getConfirmedCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("E2 마감된 회차는 occupySeat가 예외다 (D-11)")
  void occupySeatClosed() {
    CourseSession session = session(2);
    session.close();

    assertThat(session.isOpen()).isFalse();
    assertThatThrownBy(session::occupySeat).isInstanceOf(CourseStateException.class);
    assertThat(session.getConfirmedCount()).isZero();
  }

  @Test
  @DisplayName("E3 확정자가 있으면 정원을 바꿀 수 없고, 같은 정원이면 일정·장소는 바꾼다 (D-38)")
  void updateCapacityWithConfirmed() {
    CourseSession session = session(5);
    session.occupySeat();

    assertThatThrownBy(() -> session.update(LocalDate.of(2027, 1, 1), "별관", 6))
        .isInstanceOf(CourseStateException.class);
    assertThat(session.getCapacity()).isEqualTo(5);

    session.update(LocalDate.of(2027, 1, 1), "별관", 5);
    assertThat(session.getPlace()).isEqualTo("별관");
    assertThat(session.getStartDate()).isEqualTo(LocalDate.of(2027, 1, 1));
  }

  @Test
  @DisplayName("E3 확정자가 없으면 정원을 바꿀 수 있다 (D-38)")
  void updateCapacityWithoutConfirmed() {
    CourseSession session = session(5);

    session.update(LocalDate.of(2026, 12, 1), "본사", 8);

    assertThat(session.getCapacity()).isEqualTo(8);
  }

  @Test
  @DisplayName("E4 남은 자리는 정원에서 확정 인원을 뺀 값이다 (D-37)")
  void remainingSeats() {
    CourseSession session = session(3);
    assertThat(session.getRemainingSeats()).isEqualTo(3);

    session.occupySeat();

    assertThat(session.getRemainingSeats()).isEqualTo(2);
  }
}
