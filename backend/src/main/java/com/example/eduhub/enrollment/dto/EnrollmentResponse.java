package com.example.eduhub.enrollment.dto;

import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import java.time.LocalDateTime;

/** 수강 신청 결과. 대기 순번은 FR-05에서 추가한다 (D-35). */
public record EnrollmentResponse(
    Long id, Long sessionId, String employeeId, EnrollmentStatus status, LocalDateTime appliedAt) {

  public static EnrollmentResponse from(Enrollment enrollment) {
    // LAZY 프록시의 id 접근은 프록시를 초기화하지 않는다
    return new EnrollmentResponse(
        enrollment.getId(),
        enrollment.getSession().getId(),
        enrollment.getEmployeeId(),
        enrollment.getStatus(),
        enrollment.getAppliedAt());
  }
}
