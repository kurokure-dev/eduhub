package com.example.eduhub.enrollment.dto;

import com.example.eduhub.course.domain.CourseSessionStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;

/** 회차 명단 (FR-08, D-48). 계정이 없는 사번은 빠진다. */
public record RosterResponse(
    @Schema(description = "회차 ID") Long sessionId,
    @Schema(description = "과정 제목") String courseTitle,
    @Schema(description = "회차 시작일") LocalDate sessionStartDate,
    @Schema(description = "정원") int capacity,
    @Schema(description = "회차 상태") CourseSessionStatus sessionStatus,
    @Schema(description = "확정·수료자 (신청순)") List<RosterConfirmedEntry> confirmed,
    @Schema(description = "대기자 (순번순)") List<RosterWaitingEntry> waiting) {}
