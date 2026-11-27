package com.example.eduhub.enrollment.controller;

import com.example.eduhub.auth.CurrentUser;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.dto.MyEnrollmentResponse;
import com.example.eduhub.enrollment.service.EnrollmentCancelService;
import com.example.eduhub.enrollment.service.MyEnrollmentQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 내 신청 내역 조회 (FR-07). */
@Tag(name = "Enrollment")
@RestController
@RequestMapping("/api/me/enrollments")
public class MyEnrollmentController {

  private final MyEnrollmentQueryService myEnrollmentQueryService;

  private final EnrollmentCancelService enrollmentCancelService;

  public MyEnrollmentController(
      MyEnrollmentQueryService myEnrollmentQueryService,
      EnrollmentCancelService enrollmentCancelService) {
    this.myEnrollmentQueryService = myEnrollmentQueryService;
    this.enrollmentCancelService = enrollmentCancelService;
  }

  @Operation(
      summary = "내 신청 내역 조회",
      description =
          "로그인한 사용자의 신청 내역을 최근 신청순으로 돌려준다."
              + " 대기(WAITING) 건에는 현재 대기 순번(waitingRank)이 붙는다 (D-09)."
              + " 대상은 요청 값이 아니라 로그인 토큰의 사번으로 정해진다 (D-44).")
  @ApiResponse(responseCode = "200", description = "내 신청 내역 (없으면 빈 목록)")
  @ApiResponse(
      responseCode = "400",
      description = "status 값이 잘못됨",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "401",
      description = "토큰이 없거나 유효하지 않음",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping
  public List<MyEnrollmentResponse> findMine(
      @Parameter(description = "상태 (없으면 전체)") @RequestParam(required = false)
          EnrollmentStatus status,
      @AuthenticationPrincipal @Parameter(hidden = true) Jwt jwt) {
    return myEnrollmentQueryService.findMine(CurrentUser.from(jwt).employeeNo(), status);
  }

  @Operation(
      summary = "내 신청 취소",
      description =
          "확정·대기 신청을 취소한다. 확정을 취소하면 대기 1순위가 확정으로 승급한다 (D-01, D-51)."
              + " 본인 신청만 취소할 수 있고 남의 신청은 없는 신청처럼 404다 (D-45)."
              + " 마감된 회차의 신청은 취소할 수 없다 (D-02).")
  @ApiResponse(responseCode = "200", description = "취소됨 (status=CANCELLED, waitingRank=null)")
  @ApiResponse(
      responseCode = "401",
      description = "토큰이 없거나 유효하지 않음",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "없는 신청이거나 본인 신청이 아님",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "마감된 회차이거나 확정·대기 상태가 아님 (수료, 이미 취소)",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping("/{enrollmentId}/cancel")
  public EnrollmentResponse cancel(
      @PathVariable Long enrollmentId, @AuthenticationPrincipal @Parameter(hidden = true) Jwt jwt) {
    return enrollmentCancelService.cancel(enrollmentId, CurrentUser.from(jwt).employeeNo());
  }
}
