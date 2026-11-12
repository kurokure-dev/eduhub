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

  /** 대기 정렬 키. FR-04에서는 항상 null이다 (D-39). */
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
      CourseSession session, String employeeId, LocalDateTime appliedAt) {
    return new Enrollment(session, employeeId, EnrollmentStatus.WAITING, appliedAt);
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
