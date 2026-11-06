package com.example.eduhub.course.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.common.api.PageResponse;
import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.dto.CourseDetailResponse;
import com.example.eduhub.course.dto.CourseSummaryResponse;
import com.example.eduhub.course.dto.SessionResponse;
import com.example.eduhub.course.service.CourseNotFoundException;
import com.example.eduhub.course.service.CourseQueryService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CourseController.class)
class CourseControllerTest {

  @Autowired private MockMvc mockMvc;
  @MockitoBean private CourseQueryService courseQueryService;

  @Test
  @DisplayName("과정 목록은 content, page, size, totalElements를 돌려준다")
  void searchReturnsPage() throws Exception {
    given(courseQueryService.search(any(), any(), any()))
        .willReturn(
            new PageResponse<>(
                List.of(new CourseSummaryResponse(1L, "Spring 입문", "개발")), 0, 10, 1));

    mockMvc
        .perform(get("/api/v1/courses"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(1))
        .andExpect(jsonPath("$.content[0].title").value("Spring 입문"))
        .andExpect(jsonPath("$.content[0].category").value("개발"))
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(10))
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  @DisplayName("페이지 파라미터가 없으면 page 0, size 10, id 내림차순으로 조회한다 (D-18)")
  void searchUsesDefaultPageable() throws Exception {
    mockMvc.perform(get("/api/v1/courses")).andExpect(status().isOk());

    Pageable pageable = capturePageable(null, null);
    assertThat(pageable.getPageNumber()).isZero();
    assertThat(pageable.getPageSize()).isEqualTo(10);
    assertThat(pageable.getSort()).isEqualTo(Sort.by(Sort.Direction.DESC, "id"));
  }

  @Test
  @DisplayName("keyword와 category를 서비스에 그대로 넘긴다")
  void searchPassesConditions() throws Exception {
    mockMvc
        .perform(get("/api/v1/courses").param("keyword", "입문").param("category", "개발"))
        .andExpect(status().isOk());

    verify(courseQueryService).search(eq("입문"), eq("개발"), any());
  }

  @Test
  @DisplayName("클라이언트가 보낸 page, size, sort를 그대로 쓴다")
  void searchUsesRequestedPageable() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/courses").param("page", "2").param("size", "5").param("sort", "title,asc"))
        .andExpect(status().isOk());

    Pageable pageable = capturePageable(null, null);
    assertThat(pageable.getPageNumber()).isEqualTo(2);
    assertThat(pageable.getPageSize()).isEqualTo(5);
    assertThat(pageable.getSort()).isEqualTo(Sort.by(Sort.Direction.ASC, "title"));
  }

  @Test
  @DisplayName("허용하지 않은 필드로 정렬하면 400이다 (D-22)")
  void searchRejectsUnknownSort() throws Exception {
    mockMvc
        .perform(get("/api/v1/courses").param("sort", "description,asc"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400));

    verify(courseQueryService, never()).search(any(), any(), any());
  }

  @Test
  @DisplayName("과정 상세는 회차 목록을 돌려주고 남은 자리는 정원과 같다 (D-16)")
  void getDetailReturnsSessions() throws Exception {
    Course course = new Course("Spring 입문", "개발", "Spring Boot 기초 과정");
    CourseSession session = new CourseSession(course, LocalDate.of(2026, 12, 1), "본사 3층 교육장", 20);
    given(courseQueryService.getDetail(1L))
        .willReturn(CourseDetailResponse.of(course, List.of(SessionResponse.from(session))));

    mockMvc
        .perform(get("/api/v1/courses/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Spring 입문"))
        .andExpect(jsonPath("$.description").value("Spring Boot 기초 과정"))
        .andExpect(jsonPath("$.sessions[0].startDate").value("2026-12-01"))
        .andExpect(jsonPath("$.sessions[0].place").value("본사 3층 교육장"))
        .andExpect(jsonPath("$.sessions[0].capacity").value(20))
        .andExpect(jsonPath("$.sessions[0].remainingSeats").value(20));
  }

  @Test
  @DisplayName("없거나 종료된 과정의 상세는 404 ProblemDetail이다 (D-20)")
  void getDetailNotFound() throws Exception {
    given(courseQueryService.getDetail(99L)).willThrow(new CourseNotFoundException(99L));

    mockMvc
        .perform(get("/api/v1/courses/99"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.detail").value("과정을 찾을 수 없습니다: 99"));
  }

  private Pageable capturePageable(String keyword, String category) {
    ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
    verify(courseQueryService)
        .search(
            keyword == null ? isNull() : eq(keyword),
            category == null ? isNull() : eq(category),
            captor.capture());
    return captor.getValue();
  }
}
