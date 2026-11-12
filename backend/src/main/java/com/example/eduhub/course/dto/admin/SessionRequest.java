package com.example.eduhub.course.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** 회차 등록·수정 요청 (FR-03). 정원은 1 이상이다 (course_session의 CHECK 제약과 같다). */
public record SessionRequest(
    @Schema(description = "일정 (표시용, D-02)", example = "2026-12-01") @NotNull LocalDate startDate,
    @Schema(description = "장소", example = "본사 3층 교육장") @NotBlank @Size(max = 200) String place,
    @Schema(description = "정원", example = "20") @NotNull @Min(1) Integer capacity) {}
