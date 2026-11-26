package com.example.eduhub.auth.controller;

import com.example.eduhub.auth.dto.LoginRequest;
import com.example.eduhub.auth.dto.LoginResponse;
import com.example.eduhub.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 (NFR-03, D-42). */
@Tag(name = "Auth", description = "로그인과 현재 사용자")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @Operation(
      summary = "로그인",
      description = "사번과 비밀번호로 로그인해 액세스 토큰(JWT)을 받는다 (D-42)." + " 사번이 없을 때와 비밀번호가 틀릴 때 응답이 같다.")
  @SecurityRequirements()
  @ApiResponse(responseCode = "200", description = "로그인됨")
  @ApiResponse(
      responseCode = "400",
      description = "사번이나 비밀번호가 비었거나 너무 김",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "401",
      description = "사번 또는 비밀번호가 올바르지 않음",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping("/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest request) {
    return authService.login(request.employeeNo(), request.password());
  }
}
