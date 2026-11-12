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

/** 과정의 회차 (FR-02~03). 상태는 setter가 아니라 {@link #close()} 같은 메서드로만 바꾼다. */
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

  protected CourseSession() {}

  public CourseSession(Course course, LocalDate startDate, String place, int capacity) {
    this.course = course;
    this.startDate = startDate;
    this.place = place;
    this.capacity = capacity;
    this.status = CourseSessionStatus.OPEN;
  }

  /**
   * 일정·장소·정원을 바꾼다 (FR-03). 마감된 회차는 바꿀 수 없다 (D-13, D-32).
   *
   * <p>D-33: 신청 기능이 생기기 전까지는 정원 값만 바꾼다. 신청 기능을 만들 때 정원 증감에 따른 승급·강등(D-05, D-06)을 정원 변경 처리에 붙인다.
   */
  public void update(LocalDate startDate, String place, int capacity) {
    requireOpen();
    this.startDate = startDate;
    this.place = place;
    this.capacity = capacity;
  }

  /** 모집을 마감한다 (D-11). 이미 마감된 회차는 다시 마감할 수 없다 (D-32). */
  public void close() {
    requireOpen();
    this.status = CourseSessionStatus.CLOSED;
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
