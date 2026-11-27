package com.example.eduhub.enrollment.dto;

import com.example.eduhub.enrollment.domain.CompletionFailureReason;
import io.swagger.v3.oas.annotations.media.Schema;

/** 수료 처리에 실패한 사번과 사유 (D-48). */
public record CompletionFailure(
    @Schema(description = "사번") String employeeId,
    @Schema(description = "실패 사유 코드") CompletionFailureReason reason) {}
