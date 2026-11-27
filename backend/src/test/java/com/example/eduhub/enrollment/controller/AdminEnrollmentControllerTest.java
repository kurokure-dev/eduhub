package com.example.eduhub.enrollment.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.config.SecurityConfig;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.service.CourseSessionNotFoundException;
import com.example.eduhub.enrollment.domain.CompletionFailureReason;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.CompletionFailure;
import com.example.eduhub.enrollment.dto.CompletionResponse;
import com.example.eduhub.enrollment.dto.RosterConfirmedEntry;
import com.example.eduhub.enrollment.dto.RosterResponse;
import com.example.eduhub.enrollment.dto.RosterWaitingEntry;
import com.example.eduhub.enrollment.service.CompletionService;
import com.example.eduhub.enrollment.service.RosterService;
import com.example.eduhub.enrollment.service.SessionNotStartedException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest(AdminEnrollmentController.class)
@Import(SecurityConfig.class)
class AdminEnrollmentControllerTest {

  private static final String ROSTER = "/api/v1/admin/sessions/811/roster";
  private static final String COMPLETIONS = "/api/v1/admin/sessions/811/completions";

  @Autowired private MockMvc mockMvc;
  @MockitoBean private RosterService rosterService;
  @MockitoBean private CompletionService completionService;
  @MockitoBean private JwtDecoder jwtDecoder;

  private static RequestPostProcessor admin() {
    return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
  }

  private static RequestPostProcessor employee() {
    return jwt().authorities(new SimpleGrantedAuthority("ROLE_EMPLOYEE"));
  }

  @Test
  @DisplayName("W1 D-48 ADMIN이 명단을 조회하면 200이고 확정·대기 필드가 맞다")
  void rosterReturnsEntries() throws Exception {
    given(rosterService.getRoster(811L))
        .willReturn(
            new RosterResponse(
                811L,
                "Spring 입문",
                LocalDate.of(2026, 12, 8),
                20,
                CourseSessionStatus.OPEN,
                List.of(
                    new RosterConfirmedEntry(
                        1L,
                        "E001",
                        "홍길동",
                        EnrollmentStatus.CONFIRMED,
                        LocalDateTime.of(2026, 11, 20, 9, 0))),
                List.of(
                    new RosterWaitingEntry(
                        9L, "E010", "김철수", 1L, LocalDateTime.of(2026, 11, 21, 10, 0)))));

    mockMvc
        .perform(get(ROSTER).with(admin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(811))
        .andExpect(jsonPath("$.courseTitle").value("Spring 입문"))
        .andExpect(jsonPath("$.sessionStartDate").value("2026-12-08"))
        .andExpect(jsonPath("$.capacity").value(20))
        .andExpect(jsonPath("$.sessionStatus").value("OPEN"))
        .andExpect(jsonPath("$.confirmed[0].enrollmentId").value(1))
        .andExpect(jsonPath("$.confirmed[0].employeeNo").value("E001"))
        .andExpect(jsonPath("$.confirmed[0].name").value("홍길동"))
        .andExpect(jsonPath("$.confirmed[0].status").value("CONFIRMED"))
        .andExpect(jsonPath("$.confirmed[0].appliedAt").value("2026-11-20T09:00:00"))
        .andExpect(jsonPath("$.waiting[0].employeeNo").value("E010"))
        .andExpect(jsonPath("$.waiting[0].waitingRank").value(1))
        .andExpect(jsonPath("$.waiting[0].appliedAt").value("2026-11-21T10:00:00"));
  }

  @Test
  @DisplayName("W1 D-43 사원 권한으로 명단을 조회하면 403이고 서비스를 부르지 않는다")
  void rosterForbiddenForEmployee() throws Exception {
    mockMvc
        .perform(get(ROSTER).with(employee()))
        .andExpect(status().isForbidden())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(rosterService, never()).getRoster(any());
  }

  @Test
  @DisplayName("W1 D-43 토큰 없이 명단을 조회하면 401이고 서비스를 부르지 않는다")
  void rosterUnauthorizedWithoutToken() throws Exception {
    mockMvc
        .perform(get(ROSTER))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(rosterService, never()).getRoster(any());
  }

  @Test
  @DisplayName("없는 회차의 명단은 404 ProblemDetail이다")
  void rosterNotFound() throws Exception {
    given(rosterService.getRoster(811L)).willThrow(new CourseSessionNotFoundException(811L));

    mockMvc
        .perform(get(ROSTER).with(admin()))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
  }

  @Test
  @DisplayName("W2 D-48 ADMIN이 수료 처리하면 200이고 completed·failed를 돌려주며 사번이 그대로 넘어간다")
  void completeReturnsPartialSuccess() throws Exception {
    given(completionService.complete(811L, List.of("E001", "E002")))
        .willReturn(
            new CompletionResponse(
                List.of("E001"),
                List.of(new CompletionFailure("E002", CompletionFailureReason.WAITING))));

    mockMvc
        .perform(
            post(COMPLETIONS)
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": [\"E001\", \"E002\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.completed[0]").value("E001"))
        .andExpect(jsonPath("$.failed[0].employeeId").value("E002"))
        .andExpect(jsonPath("$.failed[0].reason").value("WAITING"));

    verify(completionService).complete(811L, List.of("E001", "E002"));
  }

  @Test
  @DisplayName("W3 D-48 빈 목록이면 400이고 서비스를 부르지 않는다")
  void completeRejectsEmptyList() throws Exception {
    assertBadRequest("{\"employeeIds\": []}");
  }

  @Test
  @DisplayName("W3 D-48 본문이 없으면 400이고 서비스를 부르지 않는다")
  void completeRejectsMissingBody() throws Exception {
    mockMvc
        .perform(post(COMPLETIONS).with(admin()).contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(completionService, never()).complete(any(), any());
  }

  @Test
  @DisplayName("W3 D-48 employeeIds가 없으면 400이고 서비스를 부르지 않는다")
  void completeRejectsMissingEmployeeIds() throws Exception {
    assertBadRequest("{}");
  }

  @Test
  @DisplayName("W3 D-48 201개이면 400이고 서비스를 부르지 않는다")
  void completeRejectsTooMany() throws Exception {
    String ids =
        IntStream.rangeClosed(1, 201)
            .mapToObj(i -> "\"E" + i + "\"")
            .collect(Collectors.joining(","));
    assertBadRequest("{\"employeeIds\": [" + ids + "]}");
  }

  @Test
  @DisplayName("W3 D-48 빈 사번이 있으면 400이고 서비스를 부르지 않는다")
  void completeRejectsBlankId() throws Exception {
    assertBadRequest("{\"employeeIds\": [\"E001\", \" \"]}");
  }

  @Test
  @DisplayName("W4 D-47 시작일 전이면 409 ProblemDetail이다")
  void completeBeforeStartIsConflict() throws Exception {
    given(completionService.complete(811L, List.of("E001")))
        .willThrow(new SessionNotStartedException(811L));

    mockMvc
        .perform(
            post(COMPLETIONS)
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": [\"E001\"]}"))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(409));
  }

  @Test
  @DisplayName("W4 없는 회차의 수료 처리는 404 ProblemDetail이다")
  void completeNotFound() throws Exception {
    given(completionService.complete(811L, List.of("E001")))
        .willThrow(new CourseSessionNotFoundException(811L));

    mockMvc
        .perform(
            post(COMPLETIONS)
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": [\"E001\"]}"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(404));
  }

  @Test
  @DisplayName("W5 D-43 사원 권한으로 수료 처리하면 403이고 서비스를 부르지 않는다")
  void completeForbiddenForEmployee() throws Exception {
    mockMvc
        .perform(
            post(COMPLETIONS)
                .with(employee())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": [\"E001\"]}"))
        .andExpect(status().isForbidden())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(completionService, never()).complete(any(), any());
  }

  @Test
  @DisplayName("D-43 토큰 없이 수료 처리하면 401이고 서비스를 부르지 않는다")
  void completeUnauthorizedWithoutToken() throws Exception {
    mockMvc
        .perform(
            post(COMPLETIONS)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": [\"E001\"]}"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(completionService, never()).complete(any(), any());
  }

  @Test
  @DisplayName("W3 D-48 21자 사번이면 400이고 서비스를 부르지 않는다")
  void completeRejectsTooLongId() throws Exception {
    assertBadRequest("{\"employeeIds\": [\"" + "A".repeat(21) + "\"]}");
  }

  @Test
  @DisplayName("D-48 정확히 200개는 허용되어 200이고 서비스에 그대로 넘어간다")
  void completeAcceptsExactly200() throws Exception {
    List<String> ids = IntStream.rangeClosed(1, 200).mapToObj(i -> "E" + i).toList();
    given(completionService.complete(811L, ids)).willReturn(new CompletionResponse(ids, List.of()));
    String json =
        ids.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(",", "[", "]"));

    mockMvc
        .perform(
            post(COMPLETIONS)
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": " + json + "}"))
        .andExpect(status().isOk());

    verify(completionService).complete(811L, ids);
  }

  @Test
  @DisplayName("D-48 20자 사번은 허용되어 200이고 서비스에 넘어간다")
  void completeAccepts20CharId() throws Exception {
    String id = "A".repeat(20);
    given(completionService.complete(811L, List.of(id)))
        .willReturn(new CompletionResponse(List.of(id), List.of()));

    mockMvc
        .perform(
            post(COMPLETIONS)
                .with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeIds\": [\"" + id + "\"]}"))
        .andExpect(status().isOk());

    verify(completionService).complete(811L, List.of(id));
  }

  private void assertBadRequest(String body) throws Exception {
    mockMvc
        .perform(
            post(COMPLETIONS).with(admin()).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

    verify(completionService, never()).complete(any(), any());
  }
}
