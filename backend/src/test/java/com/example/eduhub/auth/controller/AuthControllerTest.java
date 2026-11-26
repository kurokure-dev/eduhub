package com.example.eduhub.auth.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.config.SecurityConfig;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.dto.LoginResponse;
import com.example.eduhub.auth.dto.UserResponse;
import com.example.eduhub.auth.service.AuthService;
import com.example.eduhub.auth.service.InvalidCredentialsException;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({AuthController.class, MeController.class})
@Import(SecurityConfig.class)
class AuthControllerTest {

  @Autowired private MockMvc mockMvc;
  @MockitoBean private AuthService authService;
  @MockitoBean private JwtDecoder jwtDecoder;

  private static String body(String employeeNo, String password) {
    return "{\"employeeNo\":\"" + employeeNo + "\",\"password\":\"" + password + "\"}";
  }

  @Test
  @DisplayName("D-42 로그인에 성공하면 토큰과 사용자를 JSON으로 돌려준다")
  void loginSucceeds() throws Exception {
    String password = UUID.randomUUID().toString();
    given(authService.login("E1", password))
        .willReturn(
            new LoginResponse(
                "tok", "Bearer", 3600, new UserResponse(1L, "E1", "홍길동", Role.EMPLOYEE)));

    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("E1", password)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").value("tok"))
        .andExpect(jsonPath("$.tokenType").value("Bearer"))
        .andExpect(jsonPath("$.expiresIn").value(3600))
        .andExpect(jsonPath("$.user.employeeNo").value("E1"))
        .andExpect(jsonPath("$.user.role").value("EMPLOYEE"));
  }

  @Test
  @DisplayName("D-42 로그인 실패는 401 ProblemDetail이다")
  void loginFailureIsUnauthorized() throws Exception {
    String password = UUID.randomUUID().toString();
    given(authService.login("E1", password)).willThrow(new InvalidCredentialsException());

    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("E1", password)))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("사번 또는 비밀번호가 올바르지 않습니다."));
  }

  @Test
  @DisplayName("D-42 사번이 비면 400이고 서비스를 부르지 않는다")
  void blankEmployeeNoIsBadRequest() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("", UUID.randomUUID().toString())))
        .andExpect(status().isBadRequest());

    verify(authService, never()).login(any(), any());
  }

  @Test
  @DisplayName("D-42 사번 21자, 비밀번호 101자, 빈 비밀번호는 400이고 서비스를 부르지 않는다")
  void invalidLoginRequestsAreBadRequest() throws Exception {
    String[] bodies = {
      body("a".repeat(21), "pw"), body("E1", "a".repeat(101)), body("E1", ""),
    };
    for (String json : bodies) {
      mockMvc
          .perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json))
          .andExpect(status().isBadRequest());
    }

    verify(authService, never()).login(any(), any());
  }

  @Test
  @DisplayName("D-42 토큰 없이 me를 부르면 401이고 WWW-Authenticate가 있다")
  void meWithoutTokenIsUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().exists("WWW-Authenticate"));
  }

  @Test
  @DisplayName("D-42 토큰이 있으면 me는 토큰의 사원 정보를 돌려준다")
  void meReturnsCurrentUser() throws Exception {
    given(authService.me(7L)).willReturn(new UserResponse(7L, "E7", "김사원", Role.EMPLOYEE));

    mockMvc
        .perform(
            get("/api/me")
                .with(
                    jwt()
                        .jwt(
                            j ->
                                j.subject("7")
                                    .claim("employee_no", "E7")
                                    .claim("role", "EMPLOYEE"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(7))
        .andExpect(jsonPath("$.employeeNo").value("E7"))
        .andExpect(jsonPath("$.role").value("EMPLOYEE"));
  }
}
