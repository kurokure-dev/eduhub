package com.example.eduhub.enrollment.controller;

import com.example.eduhub.enrollment.dto.CompletionRequest;
import com.example.eduhub.enrollment.dto.CompletionResponse;
import com.example.eduhub.enrollment.dto.RosterResponse;
import com.example.eduhub.enrollment.service.CompletionService;
import com.example.eduhub.enrollment.service.RosterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 관리자의 회차 명단 조회와 수료 처리 (FR-08). ADMIN 권한만 접근한다 (D-43). */
@Tag(name = "Admin Enrollment", description = "관리자 회차 명단·수료")
@ApiResponse(
    responseCode = "401",
    description = "인증 필요",
    content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
@ApiResponse(
    responseCode = "403",
    description = "관리자 권한 필요",
    content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
@RestController
@RequestMapping("/api/v1/admin/sessions/{sessionId}")
public class AdminEnrollmentController {

  private final RosterService rosterService;
  private final CompletionService completionService;

  public AdminEnrollmentController(
      RosterService rosterService, CompletionService completionService) {
    this.rosterService = rosterService;
    this.completionService = completionService;
  }

  @Operation(
      summary = "회차 명단 조회",
      description = "회차 요약, 확정·수료자(신청순), 대기자(순번순)를 돌려준다. 취소는 넣지 않고, 계정이 없는 사번은 뺀다 (D-48).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "404",
      description = "없는 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping("/roster")
  public RosterResponse getRoster(@PathVariable Long sessionId) {
    return rosterService.getRoster(sessionId);
  }

  @Operation(
      summary = "수료 처리",
      description =
          "사번 목록의 확정자를 수료로 바꾼다. 회차 시작일 당일부터 할 수 있고, 그 전이면 409다 (D-47)."
              + " 사번마다 판정해 부분 성공을 허용하며, 실패한 사번은 사유 코드(WAITING, NOT_ENROLLED,"
              + " ALREADY_COMPLETED)와 함께 돌려준다. 사번은 trim 후 대소문자를 무시해 비교하고"
              + " 중복은 처음 것만 처리한다 (D-48).")
  @ApiResponse(responseCode = "200", description = "처리됨 (부분 성공 포함)")
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류 (본문 없음, 빈 목록, 201개 이상, 빈 사번, 20자 초과 사번)",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "없는 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "회차 시작일 전",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping("/completions")
  public CompletionResponse complete(
      @PathVariable Long sessionId, @Valid @RequestBody CompletionRequest request) {
    return completionService.complete(sessionId, request.employeeIds());
  }
}
