package com.example.eduhub.course.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 과정 등록·수정 요청 (FR-03). 길이 제한은 course 테이블 컬럼 길이와 같다. */
public record CourseRequest(
    @Schema(description = "제목", example = "Spring 입문") @NotBlank @Size(max = 200) String title,
    @Schema(description = "분류", example = "개발") @NotBlank @Size(max = 50) String category,
    @Schema(description = "설명 (선택)", example = "Spring Boot 기초 과정") @Size(max = 2000)
        String description) {}
