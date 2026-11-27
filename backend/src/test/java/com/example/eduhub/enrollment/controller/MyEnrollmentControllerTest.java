package com.example.eduhub.enrollment.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.config.SecurityConfig;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.MyEnrollmentResponse;
import com.example.eduhub.enrollment.service.MyEnrollmentQueryService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MyEnrollmentController.class)
@Import(SecurityConfig.class)
class MyEnrollmentControllerTest {

  private static final String URL = "/api/me/enrollments";
  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 9, 0);

  @Autowired private MockMvc mockMvc;
  @MockitoBean private MyEnrollmentQueryService service;
  @MockitoBean private JwtDecoder jwtDecoder;

  private static JwtRequestPostProcessor token(String employeeNo) {
    return jwt()
        .jwt(j -> j.subject("1").claim("employee_no", employeeNo).claim("role", "EMPLOYEE"));
  }

  @Test
  @DisplayName("C1 토큰의 사번이 서비스에 넘어가고 응답 필드가 맞다")
  void findMineUsesTokenEmployeeNo() throws Exception {
    given(service.findMine("E1", null))
        .willReturn(
            List.of(
                new MyEnrollmentResponse(
                    7L,
                    3L,
                    "Spring 입문",
                    LocalDate.of(2026, 12, 8),
                    "본사",
                    EnrollmentStatus.WAITING,
                    2L,
                    NOW)));

    mockMvc
        .perform(get(URL).with(token("E1")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].enrollmentId").value(7))
        .andExpect(jsonPath("$[0].sessionId").value(3))
        .andExpect(jsonPath("$[0].courseTitle").value("Spring 입문"))
        .andExpect(jsonPath("$[0].sessionStartDate").value("2026-12-08"))
        .andExpect(jsonPath("$[0].sessionPlace").value("본사"))
        .andExpect(jsonPath("$[0].status").value("WAITING"))
        .andExpect(jsonPath("$[0].waitingRank").value(2))
        .andExpect(jsonPath("$[0].appliedAt").exists());

    verify(service).findMine("E1", null);
  }

  @Test
  @DisplayName("C2 status를 주면 서비스가 그 값을 받고 생략하면 null을 받는다")
  void statusParam() throws Exception {
    given(service.findMine(any(), any())).willReturn(List.of());

    mockMvc
        .perform(get(URL).param("status", "WAITING").with(token("E1")))
        .andExpect(status().isOk());
    verify(service).findMine("E1", EnrollmentStatus.WAITING);

    mockMvc.perform(get(URL).with(token("E2"))).andExpect(status().isOk());
    verify(service).findMine("E2", null);
  }

  @Test
  @DisplayName("C3 토큰이 없으면 401이고 서비스를 부르지 않는다")
  void withoutTokenIsUnauthorized() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());

    verify(service, never()).findMine(any(), any());
  }

  @Test
  @DisplayName("C4 잘못된 status면 400이고 서비스를 부르지 않는다")
  void invalidStatusIsBadRequest() throws Exception {
    mockMvc
        .perform(get(URL).param("status", "FOO").with(token("E1")))
        .andExpect(status().isBadRequest());

    verify(service, never()).findMine(any(), any());
  }
}
