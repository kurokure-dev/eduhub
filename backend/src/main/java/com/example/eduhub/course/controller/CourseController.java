package com.example.eduhub.course.controller;

import com.example.eduhub.common.api.PageResponse;
import com.example.eduhub.common.error.InvalidSortException;
import com.example.eduhub.course.dto.CourseDetailResponse;
import com.example.eduhub.course.dto.CourseSummaryResponse;
import com.example.eduhub.course.service.CourseQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Set;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Course", description = "교육과정 조회")
@RestController
@RequestMapping("/api/v1/courses")
public class CourseController {

  /** D-22: 목록은 이 필드로만 정렬할 수 있다. */
  private static final Set<String> SORTABLE_PROPERTIES = Set.of("id", "title", "category");

  private final CourseQueryService courseQueryService;

  public CourseController(CourseQueryService courseQueryService) {
    this.courseQueryService = courseQueryService;
  }

  @Operation(
      summary = "과정 목록 조회",
      description =
          "종료되지 않은 과정을 페이지 단위로 조회한다. page는 0부터, 기본 정렬은 id 내림차순, 기본 크기는 10이다."
              + " 정렬 가능한 필드: id, title, category")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "400",
      description = "정렬할 수 없는 필드",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping
  public PageResponse<CourseSummaryResponse> search(
      @Parameter(description = "제목 검색어 (부분 일치)") @RequestParam(required = false) String keyword,
      @Parameter(description = "분류 (정확히 일치)") @RequestParam(required = false) String category,
      @ParameterObject @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC)
          Pageable pageable) {
    for (Sort.Order order : pageable.getSort()) {
      if (!SORTABLE_PROPERTIES.contains(order.getProperty())) {
        throw new InvalidSortException(order.getProperty());
      }
    }
    return courseQueryService.search(keyword, category, pageable);
  }

  @Operation(summary = "분류 목록 조회", description = "종료되지 않은 과정의 분류를 중복 없이 이름순으로 조회한다.")
  @GetMapping("/categories")
  public List<String> getCategories() {
    return courseQueryService.getCategories();
  }

  @Operation(summary = "과정 상세 조회", description = "과정 정보와 모집 중인 회차를 일정순으로 조회한다.")
  @ApiResponse(responseCode = "200", description = "성공")
  @ApiResponse(
      responseCode = "404",
      description = "없거나 종료된 과정",
      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
  @GetMapping("/{id}")
  public CourseDetailResponse getDetail(@PathVariable Long id) {
    return courseQueryService.getDetail(id);
  }
}
