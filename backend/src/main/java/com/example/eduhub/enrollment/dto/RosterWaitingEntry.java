package com.example.eduhub.enrollment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/** 명단의 대기자 한 명 (FR-08). */
public record RosterWaitingEntry(
    @Schema(description = "신청 ID") Long enrollmentId,
    @Schema(description = "사번") String employeeNo,
    @Schema(description = "이름") String name,
    @Schema(description = "현재 대기 순번(1부터, D-39)") long waitingRank,
    @Schema(description = "신청 일시") LocalDateTime appliedAt) {}
