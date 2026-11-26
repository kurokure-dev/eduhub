package com.example.eduhub.enrollment.dto;

import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 내 신청 내역 한 건 (FR-07). 대기 순번은 조회할 때 계산한다 (D-09, D-39). */
public record MyEnrollmentResponse(
    @Schema(description = "신청 ID") Long enrollmentId,
    @Schema(description = "회차 ID") Long sessionId,
    @Schema(description = "과정 제목") String courseTitle,
    @Schema(description = "회차 시작일 (표시용, D-02)") LocalDate sessionStartDate,
    @Schema(description = "회차 장소") String sessionPlace,
    @Schema(description = "신청 상태") EnrollmentStatus status,
    @Schema(description = "현재 대기 순번(1부터). WAITING일 때만 값이 있다 (D-09)", nullable = true)
        Long waitingRank,
    @Schema(description = "신청 일시") LocalDateTime appliedAt) {}
