package com.example.eduhub.enrollment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** 수료 처리 결과. 부분 성공을 포함하며 순서는 입력 순서를 따른다 (D-48). */
public record CompletionResponse(
    @Schema(description = "수료 처리된 사번") List<String> completed,
    @Schema(description = "수료 처리에 실패한 사번과 사유") List<CompletionFailure> failed) {}
