package com.example.eduhub.enrollment.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(EnrollmentController.class)
class EnrollmentControllerTest {

  private static final String URL = "/api/v1/sessions/3/enrollments";
  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 9, 0);

  @Autowired private MockMvc mockMvc;
  @MockitoBean private EnrollmentService enrollmentService;

  private static String body(String employeeId) {
    return "{\"employeeId\": \"" + employeeId + "\"}";
  }

  @Test
  @DisplayName("C1 확정과 대기 모두 201이고 waitingNumber 필드가 없다")
  void enrollReturnsCreated() throws Exception {
    given(enrollmentService.enroll(3L, "E1"))
        .willReturn(new EnrollmentResponse(1L, 3L, "E1", EnrollmentStatus.CONFIRMED, NOW));
    given(enrollmentService.enroll(3L, "E2"))
        .willReturn(new EnrollmentResponse(2L, 3L, "E2", EnrollmentStatus.WAITING, NOW));

    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("E1")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.sessionId").value(3))
        .andExpect(jsonPath("$.employeeId").value("E1"))
        .andExpect(jsonPath("$.status").value("CONFIRMED"))
        .andExpect(jsonPath("$.waitingNumber").doesNotExist());

    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("E2")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("WAITING"))
        .andExpect(jsonPath("$.waitingNumber").doesNotExist());
  }

  @Test
  @DisplayName("C2 본문 employeeId가 가공 없이 서비스로 넘어간다")
  void enrollPassesEmployeeIdAsIs() throws Exception {
    given(enrollmentService.enroll(3L, " E1 "))
        .willReturn(new EnrollmentResponse(1L, 3L, "E1", EnrollmentStatus.CONFIRMED, NOW));

    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body(" E1 ")))
        .andExpect(status().isCreated());

    verify(enrollmentService).enroll(3L, " E1 ");
  }

  @Test
  @DisplayName("C3 employeeId가 누락·공백·21자면 400이고 서비스를 부르지 않는다")
  void enrollRejectsInvalidEmployeeId() throws Exception {
    String[] bodies = {"{}", body(""), body("   "), body("a".repeat(21))};
    for (String json : bodies) {
      mockMvc
          .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(json))
          .andExpect(status().isBadRequest());
    }

    verify(enrollmentService, never()).enroll(any(), anyString());
  }

  @Test
  @DisplayName("C4 없는 회차는 404, 마감·중복은 409이고 problem+json이다")
  void enrollMapsErrors() throws Exception {
    given(enrollmentService.enroll(3L, "E404")).willThrow(new CourseSessionNotFoundException(3L));
    given(enrollmentService.enroll(3L, "E409A")).willThrow(new SessionClosedException(3L));
    given(enrollmentService.enroll(3L, "E409B")).willThrow(new DuplicateEnrollmentException(3L));

    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("E404")))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("E409A")))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    mockMvc
        .perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("E409B")))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
  }
}
