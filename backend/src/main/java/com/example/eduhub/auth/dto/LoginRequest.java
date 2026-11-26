package com.example.eduhub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 로그인 요청 (D-42). */
public record LoginRequest(
    @Schema(description = "사번", example = "DEV-E001", maxLength = 20) @NotBlank @Size(max = 20)
        String employeeNo,
    @Schema(description = "비밀번호", maxLength = 100) @NotBlank @Size(max = 100) String password) {

  /** 비밀번호가 로그에 찍히지 않도록 toString에서 뺀다. */
  @Override
  public String toString() {
    return "LoginRequest[employeeNo=" + employeeNo + "]";
  }
}
