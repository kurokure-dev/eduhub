package com.example.eduhub.course.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.config.SecurityConfig;
import com.example.eduhub.common.api.PageResponse;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.domain.CourseStateException;
import com.example.eduhub.course.domain.CourseStatus;
import com.example.eduhub.course.dto.admin.AdminCourseDetailResponse;
import com.example.eduhub.course.dto.admin.AdminCourseSummaryResponse;
import com.example.eduhub.course.dto.admin.AdminSessionResponse;
import com.example.eduhub.course.dto.admin.CourseRequest;
import com.example.eduhub.course.dto.admin.SessionRequest;
import com.example.eduhub.course.service.AdminCourseService;
import com.example.eduhub.course.service.CourseNotFoundException;
import com.example.eduhub.course.service.CourseSessionNotFoundException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest(AdminCourseController.class)
@Import(SecurityConfig.class)
class AdminCourseControllerTest {

  private static final String BASE = "/api/v1/admin/courses";

  @Autowired private MockMvc mockMvc;
  @MockitoBean private AdminCourseService adminCourseService;
  @MockitoBean private JwtDecoder jwtDecoder;

  private static RequestPostProcessor admin() {
    return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
  }

  @Test
  @DisplayName("D-43 토큰 없이 관리자 API를 부르면 401 ProblemDetail이고 서비스를 부르지 않는다")
  void adminWithoutTokenIsUnauthorized() throws Exception {
    mockMvc
        .perform(get(BASE))
        .andExpect(status().isUnauthorized())
        .andExpect(header().exists("WWW-Authenticate"))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("인증이 필요합니다."));

    verify(adminCourseService, never()).search(any(), any(), any(), any());
  }

  @Test
  @DisplayName("D-43 잘못된 토큰의 검증 예외 메시지는 401 본문에 새지 않는다")
  void invalidTokenDetailIsNotLeaked() throws Exception {
    given(jwtDecoder.decode("garbage")).willThrow(new BadJwtException("secret-detail"));

    mockMvc
        .perform(get(BASE).header("Authorization", "Bearer garbage"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(content().string(not(containsString("secret-detail"))));

    verify(adminCourseService, never()).search(any(), any(), any(), any());
  }

  @Test
  @DisplayName("D-43 사원 권한으로 관리자 API를 부르면 403 ProblemDetail이다")
  void adminWithEmployeeIsForbidden() throws Exception {
    mockMvc
        .perform(
            post(BASE)
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_EMPLOYEE")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(COURSE_JSON))
        .andExpect(status().isForbidden())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("권한이 없습니다."));

    verify(adminCourseService, never()).create(any());
  }

  private static final String COURSE_JSON =
      """
      {"title": "Spring 입문", "category": "개발", "description": "기초"}
      """;
  private static final String SESSION_JSON =
      """
      {"startDate": "2026-12-01", "place": "본사 3층", "capacity": 20}
      """;

  @Test
  @DisplayName("목록은 상태를 포함하고, status 조건을 서비스에 넘긴다 (D-34)")
  void searchPassesStatus() throws Exception {
    given(adminCourseService.search(eq(CourseStatus.CLOSED), isNull(), isNull(), any()))
        .willReturn(
            new PageResponse<>(
                List.of(new AdminCourseSummaryResponse(1L, "Spring 입문", "개발", CourseStatus.CLOSED)),
                0,
                10,
                1));

    mockMvc
        .perform(get(BASE).with(admin()).param("status", "CLOSED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].status").value("CLOSED"))
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  @DisplayName("허용하지 않은 필드로 정렬하면 400이다")
  void searchRejectsInvalidSort() throws Exception {
    mockMvc
        .perform(get(BASE).with(admin()).param("sort", "description"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(adminCourseService, never()).search(any(), any(), any(), any());
  }

  @Test
  @DisplayName("없는 과정의 상세는 404다")
  void getDetailNotFound() throws Exception {
    given(adminCourseService.getDetail(99L)).willThrow(new CourseNotFoundException(99L));

    mockMvc.perform(get(BASE + "/99").with(admin())).andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("과정을 등록하면 201과 등록된 과정을 돌려준다")
  void createCourse() throws Exception {
    given(adminCourseService.create(new CourseRequest("Spring 입문", "개발", "기초")))
        .willReturn(
            new AdminCourseDetailResponse(
                1L, "Spring 입문", "개발", "기초", CourseStatus.OPEN, List.of()));

    mockMvc
        .perform(
            post(BASE).with(admin()).contentType(MediaType.APPLICATION_JSON).content(COURSE_JSON))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.status").value("OPEN"));
  }

  @Test
  @DisplayName("제목이 비었거나 분류가 50자를 넘으면 400이고 서비스를 부르지 않는다")
  void createCourseValidation() throws Exception {
    mockMvc
        .perform(
            post(BASE)
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title": " ", "category": "%s"}
                    """
                        .formatted("가".repeat(51))))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(adminCourseService, never()).create(any());
  }

  @Test
  @DisplayName("종료된 과정을 수정하면 409다 (D-32)")
  void updateClosedCourseConflict() throws Exception {
    given(adminCourseService.update(eq(1L), any()))
        .willThrow(new CourseStateException("종료된 과정은 변경할 수 없습니다: 1"));

    mockMvc
        .perform(
            put(BASE + "/1")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(COURSE_JSON))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.detail").value("종료된 과정은 변경할 수 없습니다: 1"));
  }

  @Test
  @DisplayName("과정을 종료하면 종료 상태와 마감된 회차를 돌려준다 (D-31)")
  void closeCourse() throws Exception {
    given(adminCourseService.close(1L))
        .willReturn(
            new AdminCourseDetailResponse(
                1L,
                "Spring 입문",
                "개발",
                null,
                CourseStatus.CLOSED,
                List.of(
                    new AdminSessionResponse(
                        10L, LocalDate.of(2026, 12, 1), "본사", 20, CourseSessionStatus.CLOSED, 5))));

    mockMvc
        .perform(post(BASE + "/1/close").with(admin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CLOSED"))
        .andExpect(jsonPath("$.sessions[0].status").value("CLOSED"))
        .andExpect(jsonPath("$.sessions[0].confirmedCount").value(5));
  }

  @Test
  @DisplayName("회차를 등록하면 201이다")
  void createSession() throws Exception {
    given(
            adminCourseService.createSession(
                1L, new SessionRequest(LocalDate.of(2026, 12, 1), "본사 3층", 20)))
        .willReturn(
            new AdminSessionResponse(
                10L, LocalDate.of(2026, 12, 1), "본사 3층", 20, CourseSessionStatus.OPEN, 0));

    mockMvc
        .perform(
            post(BASE + "/1/sessions")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(SESSION_JSON))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(10))
        .andExpect(jsonPath("$.startDate").value("2026-12-01"))
        .andExpect(jsonPath("$.status").value("OPEN"));
  }

  @Test
  @DisplayName("정원이 0이거나 일정이 없으면 400이다")
  void sessionValidation() throws Exception {
    mockMvc
        .perform(
            put(BASE + "/1/sessions/10")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"place": "본사", "capacity": 0}
                    """))
        .andExpect(status().isBadRequest());

    verify(adminCourseService, never()).updateSession(any(), any(), any());
  }

  @Test
  @DisplayName("마감된 회차의 정원을 바꾸면 409다 (D-13)")
  void updateClosedSessionConflict() throws Exception {
    given(adminCourseService.updateSession(eq(1L), eq(10L), any()))
        .willThrow(new CourseStateException("마감된 회차는 변경할 수 없습니다: 10"));

    mockMvc
        .perform(
            put(BASE + "/1/sessions/10")
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(SESSION_JSON))
        .andExpect(status().isConflict());
  }

  @Test
  @DisplayName("다른 과정의 회차를 마감하려 하면 404다")
  void closeSessionNotFound() throws Exception {
    given(adminCourseService.closeSession(2L, 10L))
        .willThrow(new CourseSessionNotFoundException(2L, 10L));

    mockMvc
        .perform(post(BASE + "/2/sessions/10/close").with(admin()))
        .andExpect(status().isNotFound());
  }
}
