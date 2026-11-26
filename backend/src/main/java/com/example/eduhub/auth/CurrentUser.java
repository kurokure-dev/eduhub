package com.example.eduhub.auth;

import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.common.error.UnauthorizedException;
import org.springframework.security.oauth2.jwt.Jwt;

/** 토큰에서 읽은 현재 사용자 (NFR-03, D-44). 클레임이 없거나 형식이 틀리면 401이다. */
public record CurrentUser(Long id, String employeeNo, Role role) {

  private static final String INVALID = "유효하지 않은 토큰입니다.";

  public static CurrentUser from(Jwt jwt) {
    String subject = jwt.getSubject();
    String employeeNo = jwt.getClaimAsString("employee_no");
    String role = jwt.getClaimAsString("role");
    if (subject == null || employeeNo == null || role == null) {
      throw new UnauthorizedException(INVALID);
    }
    try {
      return new CurrentUser(Long.valueOf(subject), employeeNo, Role.valueOf(role));
    } catch (IllegalArgumentException e) {
      throw new UnauthorizedException(INVALID);
    }
  }
}
