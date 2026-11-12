package com.example.eduhub.course.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * 과정의 회차 (FR-02~03). 상태는 setter가 아니라 {@link #close()} 같은 메서드로만 바꾼다.
 *
 * <p>확정 인원(D-37)이 있는 회차는 정원을 바꿀 수 없다 (D-38).
 */
@Entity
@Table(name = "course_session")
public class CourseSession {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "course_id", nullable = false)
  private Course course;

  /** 표시용 일정 (FR-02). 취소·마감 판단에는 쓰지 않는다 (D-02). */
  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(nullable = false, length = 200)
  private String place;

  @Column(nullable = false)
  private int capacity;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CourseSessionStatus status;

  /** 확정 인원 (D-37). 회차 행 락 안에서만 바꾼다 (D-29). */
  @Column(name = "confirmed_count", nullable = false)
  private int confirmedCount;

  protected CourseSession() {}

  public CourseSession(Course course, LocalDate startDate, String place, int capacity) {
    this.course = course;
    this.startDate = startDate;
    this.place = place;
    this.capacity = capacity;
    this.status = CourseSessionStatus.OPEN;
    this.confirmedCount = 0;
  }

  /**
   * 일정·장소·정원을 바꾼다 (FR-03). 마감된 회차는 바꿀 수 없다 (D-13, D-32).
   *
   * <p>D-38: 확정자가 있는 회차는 정원을 바꿀 수 없다. 정원 증감에 따른 승급·강등(D-05, D-06)은 FR-06에서 붙이며 그때 이 제한을 푼다.
   */
  public void update(LocalDate startDate, String place, int capacity) {
    requireOpen();
    if (confirmedCount > 0 && capacity != this.capacity) {
      throw new CourseStateException("확정자가 있는 회차는 정원을 바꿀 수 없습니다: " + id);
    }
    this.startDate = startDate;
    this.place = place;
    this.capacity = capacity;
  }

  /** 모집을 마감한다 (D-11). 이미 마감된 회차는 다시 마감할 수 없다 (D-32). */
  public void close() {
    requireOpen();
    this.status = CourseSessionStatus.CLOSED;
  }

  /** 확정 자리 하나를 차지한다 (D-37). 회차 행 락을 잡은 상태에서만 부른다 (D-29). */
  public void occupySeat() {
    requireOpen();
    if (!hasRemainingSeat()) {
      throw new CourseStateException("남은 자리가 없습니다: " + id);
    }
    confirmedCount++;
  }

  public boolean hasRemainingSeat() {
    return confirmedCount < capacity;
  }

  public boolean isOpen() {
    return status == CourseSessionStatus.OPEN;
  }

  public int getRemainingSeats() {
    return capacity - confirmedCount;
  }

  public int getConfirmedCount() {
    return confirmedCount;
  }

  private void requireOpen() {
    if (status == CourseSessionStatus.CLOSED) {
      throw new CourseStateException("마감된 회차는 변경할 수 없습니다: " + id);
    }
  }

  public Long getId() {
    return id;
  }

  public Course getCourse() {
    return course;
  }

  public LocalDate getStartDate() {
    return startDate;
  }

  public String getPlace() {
    return place;
  }

  public int getCapacity() {
    return capacity;
  }

  public CourseSessionStatus getStatus() {
    return status;
  }
}
