package com.example.eduhub.auth.dto;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.service.IssuedToken;
import io.swagger.v3.oas.annotations.media.Schema;

/** 로그인 응답 (D-42). */
public record LoginResponse(
    @Schema(description = "액세스 토큰(JWT)") String accessToken,
    @Schema(description = "토큰 종류", example = "Bearer") String tokenType,
    @Schema(description = "만료까지 남은 초", example = "3600") long expiresIn,
    @Schema(description = "로그인한 사용자") UserResponse user) {

  public static LoginResponse of(IssuedToken token, Employee employee) {
    return new LoginResponse(
        token.value(), "Bearer", token.expiresInSeconds(), UserResponse.from(employee));
  }
}
