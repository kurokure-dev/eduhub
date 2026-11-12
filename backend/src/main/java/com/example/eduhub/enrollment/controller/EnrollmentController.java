package com.example.eduhub.enrollment.controller;

import com.example.eduhub.enrollment.dto.EnrollRequest;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.service.EnrollmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 수강 신청 (FR-04). */
@Tag(name = "수강 신청", description = "회차 수강 신청")
@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/enrollments")
public class EnrollmentController {

  private final EnrollmentService enrollmentService;

  public EnrollmentController(EnrollmentService enrollmentService) {
    this.enrollmentService = enrollmentService;
  }

  @Operation(
      summary = "수강 신청",
      description =
          "회차에 신청한다. 자리가 있고 대기자가 없으면 확정(CONFIRMED), 아니면 대기(WAITING)로 등록된다 (D-35)."
              + " 인증 도입 전까지 사번을 본문으로 받는다 (D-36)."
              + " 같은 회차에 확정·대기 신청이 이미 있으면 거절하지만, 취소 후 재신청은 된다 (D-07)."
              + " 마감된 회차는 신청할 수 없다.")
  @ApiResponse(responseCode = "201", description = "신청됨 (확정 또는 대기)")
  @ApiResponse(
      responseCode = "400",
      description = "사번이 비었거나 20자를 넘음",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "없는 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "마감된 회차이거나 이미 신청함",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public EnrollmentResponse enroll(
      @PathVariable Long sessionId, @Valid @RequestBody EnrollRequest request) {
    // TODO(NFR-03): 인증 도입 시 현재 로그인 사용자 사번으로 교체한다 (D-36)
    return enrollmentService.enroll(sessionId, request.employeeId());
  }
}
