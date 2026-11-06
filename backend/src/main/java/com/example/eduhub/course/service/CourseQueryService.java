package com.example.eduhub.course.service;

import com.example.eduhub.common.api.PageResponse;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.domain.CourseStatus;
import com.example.eduhub.course.dto.CourseDetailResponse;
import com.example.eduhub.course.dto.CourseSummaryResponse;
import com.example.eduhub.course.dto.SessionResponse;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 과정 조회 (FR-01, FR-02). */
@Service
@Transactional(readOnly = true)
public class CourseQueryService {

  private final CourseRepository courseRepository;
  private final CourseSessionRepository courseSessionRepository;

  public CourseQueryService(
      CourseRepository courseRepository, CourseSessionRepository courseSessionRepository) {
    this.courseRepository = courseRepository;
    this.courseSessionRepository = courseSessionRepository;
  }

  /** 종료되지 않은 과정을 검색한다 (D-17, D-18). 빈 검색어는 조건 없음으로 본다. */
  public PageResponse<CourseSummaryResponse> search(
      String keyword, String category, Pageable pageable) {
    return PageResponse.from(
        courseRepository
            .search(CourseStatus.OPEN, blankToNull(keyword), blankToNull(category), pageable)
            .map(CourseSummaryResponse::from));
  }

  /** 과정 상세와 모집 중인 회차를 조회한다. 없거나 종료된 과정이면 404다 (D-19, D-20). */
  public CourseDetailResponse getDetail(Long id) {
    var course =
        courseRepository
            .findById(id)
            .filter(found -> found.getStatus() == CourseStatus.OPEN)
            .orElseThrow(() -> new CourseNotFoundException(id));
    List<SessionResponse> sessions =
        courseSessionRepository
            .findByCourseIdAndStatusOrderByStartDateAscIdAsc(id, CourseSessionStatus.OPEN)
            .stream()
            .map(SessionResponse::from)
            .toList();
    return CourseDetailResponse.of(course, sessions);
  }

  private static String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}
