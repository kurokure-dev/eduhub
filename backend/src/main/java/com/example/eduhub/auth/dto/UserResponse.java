package com.example.eduhub.auth.dto;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import io.swagger.v3.oas.annotations.media.Schema;

/** 현재 사용자 정보 (D-42). */
public record UserResponse(
    @Schema(description = "사원 id") Long id,
    @Schema(description = "사번", example = "DEV-E001") String employeeNo,
    @Schema(description = "이름") String name,
    @Schema(description = "역할") Role role) {

  public static UserResponse from(Employee employee) {
    return new UserResponse(
        employee.getId(), employee.getEmployeeNo(), employee.getName(), employee.getRole());
  }
}
