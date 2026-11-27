package com.example.eduhub.enrollment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 수료 처리 요청 (FR-08, D-48). */
public record CompletionRequest(
    @Schema(
            description = "수료 처리할 사번 목록 (1~200개, 사번은 최대 20자, 중복은 처음 것만 처리)",
            example = "[\"E001\", \"E002\"]")
        @NotEmpty
        @Size(max = 200)
        List<@NotBlank @Size(max = 20) String> employeeIds) {}
