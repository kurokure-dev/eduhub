package com.example.eduhub.auth.controller;

import com.example.eduhub.auth.CurrentUser;
import com.example.eduhub.auth.dto.UserResponse;
import com.example.eduhub.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 현재 사용자 조회 (NFR-03, D-42). */
@Tag(name = "Auth", description = "로그인과 현재 사용자")
@RestController
public class MeController {

  private final AuthService authService;

  public MeController(AuthService authService) {
    this.authService = authService;
  }

  @Operation(summary = "현재 사용자 조회", description = "토큰의 사원 id로 DB를 다시 조회한다 (D-42).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "401",
      description = "토큰이 없거나 유효하지 않음, 사원이 없음",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping("/api/me")
  public UserResponse me(@AuthenticationPrincipal @Parameter(hidden = true) Jwt jwt) {
    return authService.me(CurrentUser.from(jwt).id());
  }
}
