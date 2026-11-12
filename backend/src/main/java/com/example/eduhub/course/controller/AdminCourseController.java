package com.example.eduhub.course.controller;

import com.example.eduhub.common.api.PageResponse;
import com.example.eduhub.common.error.InvalidSortException;
import com.example.eduhub.course.domain.CourseStatus;
import com.example.eduhub.course.dto.admin.AdminCourseDetailResponse;
import com.example.eduhub.course.dto.admin.AdminCourseSummaryResponse;
import com.example.eduhub.course.dto.admin.AdminSessionResponse;
import com.example.eduhub.course.dto.admin.CourseRequest;
import com.example.eduhub.course.dto.admin.SessionRequest;
import com.example.eduhub.course.service.AdminCourseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Set;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 관리자의 과정·회차 관리 (FR-03). 인증 방식이 정해지기 전까지 권한 검사는 하지 않는다 (D-30). */
@Tag(name = "AdminCourse", description = "관리자 교육과정·회차 관리")
@RestController
@RequestMapping("/api/v1/admin/courses")
public class AdminCourseController {

  /** 관리자 목록은 이 필드로만 정렬할 수 있다 (D-22에 상태를 더함). */
  private static final Set<String> SORTABLE_PROPERTIES =
      Set.of("id", "title", "category", "status");

  private final AdminCourseService adminCourseService;

  public AdminCourseController(AdminCourseService adminCourseService) {
    this.adminCourseService = adminCourseService;
  }

  @Operation(
      summary = "관리자 과정 목록 조회",
      description =
          "종료된 과정을 포함해 페이지 단위로 조회한다 (D-34). status를 주면 그 상태만 조회한다."
              + " page는 0부터, 기본 정렬은 id 내림차순, 기본 크기는 10이다. 정렬 가능한 필드: id, title, category, status")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "400",
      description = "정렬할 수 없는 필드",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping
  public PageResponse<AdminCourseSummaryResponse> searchAdminCourses(
      @Parameter(description = "상태 (없으면 전체)") @RequestParam(required = false) CourseStatus status,
      @Parameter(description = "제목 검색어 (부분 일치)") @RequestParam(required = false) String keyword,
      @Parameter(description = "분류 (정확히 일치)") @RequestParam(required = false) String category,
      @ParameterObject @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC)
          Pageable pageable) {
    for (Sort.Order order : pageable.getSort()) {
      if (!SORTABLE_PROPERTIES.contains(order.getProperty())) {
        throw new InvalidSortException(order.getProperty());
      }
    }
    return adminCourseService.search(status, keyword, category, pageable);
  }

  @Operation(summary = "관리자 과정 상세 조회", description = "과정과 모든 회차(마감 포함)를 일정순으로 조회한다 (D-34).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "404",
      description = "없는 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping("/{id}")
  public AdminCourseDetailResponse getAdminCourse(@PathVariable Long id) {
    return adminCourseService.getDetail(id);
  }

  @Operation(summary = "과정 등록", description = "운영 중(OPEN) 상태의 과정을 등록한다.")
  @ApiResponse(responseCode = "201", description = "등록됨")
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public AdminCourseDetailResponse createCourse(@Valid @RequestBody CourseRequest request) {
    return adminCourseService.create(request);
  }

  @Operation(summary = "과정 수정", description = "제목·분류·설명을 바꾼다. 종료된 과정은 바꿀 수 없다 (D-32).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "없는 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "종료된 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PutMapping("/{id}")
  public AdminCourseDetailResponse updateCourse(
      @PathVariable Long id, @Valid @RequestBody CourseRequest request) {
    return adminCourseService.update(id, request);
  }

  @Operation(
      summary = "과정 종료",
      description = "과정을 종료하고 모집 중인 회차를 모두 마감한다 (D-31). 종료된 과정은 임직원 목록에서 빠진다 (D-17).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "404",
      description = "없는 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "이미 종료된 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping("/{id}/close")
  public AdminCourseDetailResponse closeCourse(@PathVariable Long id) {
    return adminCourseService.close(id);
  }

  @Operation(summary = "회차 등록", description = "모집 중(OPEN) 상태의 회차를 추가한다. 종료된 과정에는 추가할 수 없다 (D-32).")
  @ApiResponse(responseCode = "201", description = "등록됨")
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "없는 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "종료된 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping("/{id}/sessions")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminSessionResponse createSession(
      @PathVariable Long id, @Valid @RequestBody SessionRequest request) {
    return adminCourseService.createSession(id, request);
  }

  @Operation(summary = "회차 수정", description = "일정·장소·정원을 바꾼다. 마감된 회차는 바꿀 수 없다 (D-13, D-32).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "없는 과정이나 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "마감된 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PutMapping("/{id}/sessions/{sessionId}")
  public AdminSessionResponse updateSession(
      @PathVariable Long id,
      @PathVariable Long sessionId,
      @Valid @RequestBody SessionRequest request) {
    return adminCourseService.updateSession(id, sessionId, request);
  }

  @Operation(summary = "회차 마감", description = "회차 모집을 마감한다 (D-04, D-11).")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "404",
      description = "없는 과정이나 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "409",
      description = "이미 마감된 회차",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @PostMapping("/{id}/sessions/{sessionId}/close")
  public AdminSessionResponse closeSession(@PathVariable Long id, @PathVariable Long sessionId) {
    return adminCourseService.closeSession(id, sessionId);
  }
}
