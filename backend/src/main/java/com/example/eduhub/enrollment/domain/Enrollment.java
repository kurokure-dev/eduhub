package com.example.eduhub.enrollment.domain;

import com.example.eduhub.course.domain.CourseSession;
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
import java.time.LocalDateTime;

/** 수강 신청 (FR-04~08). 같은 회차에 확정·대기 신청은 한 사람당 하나다 (D-07, DB 유일 인덱스 {@code ux_enrollment_active}). */
@Entity
@Table(name = "enrollment")
public class Enrollment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "session_id", nullable = false)
  private CourseSession session;

  @Column(name = "employee_id", nullable = false, length = 20)
  private String employeeId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private EnrollmentStatus status;

  /** 대기 정렬 키. 대기 신청은 회차 안에서 유일한 값을 가지고, 그 밖의 상태는 null이다 (D-39, D-46). */
  @Column(name = "waiting_order")
  private Long waitingOrder;

  @Column(name = "applied_at", nullable = false)
  private LocalDateTime appliedAt;

  protected Enrollment() {}

  private Enrollment(
      CourseSession session, String employeeId, EnrollmentStatus status, LocalDateTime appliedAt) {
    this.session = session;
    this.employeeId = employeeId;
    this.status = status;
    this.appliedAt = appliedAt;
  }

  public static Enrollment confirmed(
      CourseSession session, String employeeId, LocalDateTime appliedAt) {
    return new Enrollment(session, employeeId, EnrollmentStatus.CONFIRMED, appliedAt);
  }

  public static Enrollment waiting(
      CourseSession session, String employeeId, LocalDateTime appliedAt, long waitingOrder) {
    Enrollment enrollment =
        new Enrollment(session, employeeId, EnrollmentStatus.WAITING, appliedAt);
    enrollment.waitingOrder = waitingOrder;
    return enrollment;
  }

  /** 확정 신청을 수료로 바꾼다 (D-03, D-48). 확정이 아니면 예외다. 확정 인원(D-37)은 유지한다. */
  public void complete() {
    if (status != EnrollmentStatus.CONFIRMED) {
      throw new IllegalStateException("확정 상태만 수료 처리할 수 있습니다: " + status);
    }
    this.status = EnrollmentStatus.COMPLETED;
  }

  /** 확정·대기 신청을 취소한다 (D-52). 그 밖의 상태면 예외다. 대기 키는 비운다 (D-46). */
  public void cancel() {
    if (status != EnrollmentStatus.CONFIRMED && status != EnrollmentStatus.WAITING) {
      throw new IllegalStateException("확정 또는 대기 상태만 취소할 수 있습니다: " + status);
    }
    this.status = EnrollmentStatus.CANCELLED;
    this.waitingOrder = null;
  }

  /** 대기 신청을 확정으로 올린다 (D-01, D-52). 대기가 아니면 예외다. 대기 키는 비운다 (D-46). */
  public void promote() {
    if (status != EnrollmentStatus.WAITING) {
      throw new IllegalStateException("대기 상태만 확정으로 승급할 수 있습니다: " + status);
    }
    this.status = EnrollmentStatus.CONFIRMED;
    this.waitingOrder = null;
  }

  public Long getId() {
    return id;
  }

  public CourseSession getSession() {
    return session;
  }

  public String getEmployeeId() {
    return employeeId;
  }

  public EnrollmentStatus getStatus() {
    return status;
  }

  public Long getWaitingOrder() {
    return waitingOrder;
  }

  public LocalDateTime getAppliedAt() {
    return appliedAt;
  }
}
