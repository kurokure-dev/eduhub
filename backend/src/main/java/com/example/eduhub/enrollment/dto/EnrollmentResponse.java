package com.example.eduhub.enrollment.dto;

import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/** 수강 신청·취소 결과 (D-52). */
public record EnrollmentResponse(
    Long id,
    Long sessionId,
    String employeeId,
    EnrollmentStatus status,
    @Schema(description = "대기 순번. 상태가 WAITING일 때만 값이 있다 (D-52)", nullable = true) Long waitingRank,
    LocalDateTime appliedAt) {

  public static EnrollmentResponse from(Enrollment enrollment, Long waitingRank) {
    // LAZY 프록시의 id 접근은 프록시를 초기화하지 않는다
    return new EnrollmentResponse(
        enrollment.getId(),
        enrollment.getSession().getId(),
        enrollment.getEmployeeId(),
        enrollment.getStatus(),
        waitingRank,
        enrollment.getAppliedAt());
  }
}
