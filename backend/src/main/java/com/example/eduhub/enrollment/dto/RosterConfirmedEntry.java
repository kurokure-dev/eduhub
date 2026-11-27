package com.example.eduhub.enrollment.dto;

import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/** 명단의 확정·수료자 한 명 (FR-08). */
public record RosterConfirmedEntry(
    @Schema(description = "신청 ID") Long enrollmentId,
    @Schema(description = "사번") String employeeNo,
    @Schema(description = "이름") String name,
    @Schema(description = "신청 상태 (CONFIRMED 또는 COMPLETED)") EnrollmentStatus status,
    @Schema(description = "신청 일시") LocalDateTime appliedAt) {}
