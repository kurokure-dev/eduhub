package com.example.eduhub.enrollment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 수강 신청 요청. 인증 도입 전까지 사번을 본문으로 받는다 (D-36). */
public record EnrollRequest(
    @Schema(description = "사번", example = "E2024001") @NotBlank @Size(max = 20)
        String employeeId) {}
