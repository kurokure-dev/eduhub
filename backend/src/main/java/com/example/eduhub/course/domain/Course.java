package com.example.eduhub.course.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 교육과정 (FR-01~03). 상태는 setter가 아니라 {@link #close()} 같은 메서드로만 바꾼다. */
@Entity
@Table(name = "course")
public class Course {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(nullable = false, length = 50)
  private String category;

  @Column(length = 2000)
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CourseStatus status;

  protected Course() {}

  public Course(String title, String category, String description) {
    this.title = title;
    this.category = category;
    this.description = description;
    this.status = CourseStatus.OPEN;
  }

  /** 과정 정보를 바꾼다 (FR-03). 종료된 과정은 바꿀 수 없다 (D-32). */
  public void update(String title, String category, String description) {
    requireOpen();
    this.title = title;
    this.category = category;
    this.description = description;
  }

  /**
   * 과정을 종료한다 (FR-03). 이미 종료된 과정은 다시 종료할 수 없다 (D-32).
   *
   * <p>모집 중인 회차의 마감(D-31)은 회차를 아는 서비스가 맡는다.
   */
  public void close() {
    requireOpen();
    this.status = CourseStatus.CLOSED;
  }

  /** 종료되지 않은 과정인지 확인한다. 종료됐으면 {@link CourseStateException}을 던진다 (D-32). */
  public void requireOpen() {
    if (status == CourseStatus.CLOSED) {
      throw new CourseStateException("종료된 과정은 변경할 수 없습니다: " + id);
    }
  }

  public Long getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public String getCategory() {
    return category;
  }

  public String getDescription() {
    return description;
  }

  public CourseStatus getStatus() {
    return status;
  }
}
