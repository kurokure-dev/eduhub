package com.example.eduhub.enrollment.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.config.SecurityConfig;
import com.example.eduhub.course.service.CourseSessionNotFoundException;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.service.DuplicateEnrollmentException;
import com.example.eduhub.enrollment.service.EnrollmentService;
import com.example.eduhub.enrollment.service.SessionClosedException;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(EnrollmentController.class)
@Import(SecurityConfig.class)
class EnrollmentControllerTest {

  private static final String URL = "/api/v1/sessions/3/enrollments";
  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 9, 0);

  @Autowired private MockMvc mockMvc;
  @MockitoBean private EnrollmentService enrollmentService;
  @MockitoBean private JwtDecoder jwtDecoder;

  private static JwtRequestPostProcessor token(String employeeNo) {
    return jwt()
        .jwt(j -> j.subject("1").claim("employee_no", employeeNo).claim("role", "EMPLOYEE"));
  }

  @Test
  @DisplayName("C1 확정과 대기 모두 201이고 waitingNumber 필드가 없다")
  void enrollReturnsCreated() throws Exception {
    given(enrollmentService.enroll(3L, "E1"))
        .willReturn(new EnrollmentResponse(1L, 3L, "E1", EnrollmentStatus.CONFIRMED, NOW));
    given(enrollmentService.enroll(3L, "E2"))
        .willReturn(new EnrollmentResponse(2L, 3L, "E2", EnrollmentStatus.WAITING, NOW));

    mockMvc
        .perform(post(URL).with(token("E1")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.sessionId").value(3))
        .andExpect(jsonPath("$.employeeId").value("E1"))
        .andExpect(jsonPath("$.status").value("CONFIRMED"))
        .andExpect(jsonPath("$.waitingNumber").doesNotExist());

    mockMvc
        .perform(post(URL).with(token("E2")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("WAITING"))
        .andExpect(jsonPath("$.waitingNumber").doesNotExist());
  }

  @Test
  @DisplayName("C2 본문에 다른 사번을 넣어도 토큰의 사번으로 서비스를 부른다 (D-44)")
  void enrollUsesTokenEmployeeNo() throws Exception {
    given(enrollmentService.enroll(3L, "E1"))
        .willReturn(new EnrollmentResponse(1L, 3L, "E1", EnrollmentStatus.CONFIRMED, NOW));

    mockMvc
        .perform(
            post(URL)
                .with(token("E1"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeId\": \"OTHER\"}"))
        .andExpect(status().isCreated());

    verify(enrollmentService).enroll(3L, "E1");
    verify(enrollmentService, never()).enroll(3L, "OTHER");
  }

  @Test
  @DisplayName("C3 토큰이 없으면 401이고 서비스를 부르지 않는다")
  void enrollWithoutTokenIsUnauthorized() throws Exception {
    mockMvc.perform(post(URL)).andExpect(status().isUnauthorized());

    verify(enrollmentService, never()).enroll(any(), anyString());
  }

  @Test
  @DisplayName("C3b employee_no 클레임이 없는 토큰이면 401이고 서비스를 부르지 않는다")
  void enrollWithoutEmployeeNoClaimIsUnauthorized() throws Exception {
    mockMvc
        .perform(post(URL).with(jwt().jwt(j -> j.subject("1").claim("role", "EMPLOYEE"))))
        .andExpect(status().isUnauthorized());

    verify(enrollmentService, never()).enroll(any(), anyString());
  }

  @Test
  @DisplayName("C4 없는 회차는 404, 마감·중복은 409이고 problem+json이다")
  void enrollMapsErrors() throws Exception {
    given(enrollmentService.enroll(3L, "E404")).willThrow(new CourseSessionNotFoundException(3L));
    given(enrollmentService.enroll(3L, "E409A")).willThrow(new SessionClosedException(3L));
    given(enrollmentService.enroll(3L, "E409B")).willThrow(new DuplicateEnrollmentException(3L));

    mockMvc
        .perform(post(URL).with(token("E404")))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    mockMvc
        .perform(post(URL).with(token("E409A")))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    mockMvc
        .perform(post(URL).with(token("E409B")))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
  }
}
