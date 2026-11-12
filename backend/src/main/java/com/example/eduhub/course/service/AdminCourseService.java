package com.example.eduhub.course.service;

import com.example.eduhub.common.api.PageResponse;
import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.domain.CourseStatus;
import com.example.eduhub.course.dto.admin.AdminCourseDetailResponse;
import com.example.eduhub.course.dto.admin.AdminCourseSummaryResponse;
import com.example.eduhub.course.dto.admin.AdminSessionResponse;
import com.example.eduhub.course.dto.admin.CourseRequest;
import com.example.eduhub.course.dto.admin.SessionRequest;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 관리자의 과정·회차 등록, 수정, 종료 (FR-03).
 *
 * <p>권한 검사는 인증 방식이 정해진 뒤 붙인다 (D-30). 신청 기능이 생기면 회차 마감(D-04)과 정원 변경(D-05, D-06)이 대기열을 바꾸므로 회차 단위로
 * 직렬화해야 한다 (NFR-01).
 */
@Service
@Transactional
public class AdminCourseService {

  private final CourseRepository courseRepository;
  private final CourseSessionRepository courseSessionRepository;

  public AdminCourseService(
      CourseRepository courseRepository, CourseSessionRepository courseSessionRepository) {
    this.courseRepository = courseRepository;
    this.courseSessionRepository = courseSessionRepository;
  }

  /** 종료된 과정을 포함해 검색한다 (D-34). 빈 검색어는 조건 없음으로 본다. */
  @Transactional(readOnly = true)
  public PageResponse<AdminCourseSummaryResponse> search(
      CourseStatus status, String keyword, String category, Pageable pageable) {
    return PageResponse.from(
        courseRepository
            .adminSearch(status, blankToNull(keyword), blankToNull(category), pageable)
            .map(AdminCourseSummaryResponse::from));
  }

  /** 과정과 모든 회차를 조회한다 (D-34). 종료된 과정도 조회된다. */
  @Transactional(readOnly = true)
  public AdminCourseDetailResponse getDetail(Long id) {
    return toDetail(findCourse(id));
  }

  /** 과정을 등록한다. 새 과정은 운영 중(OPEN)이다. */
  public AdminCourseDetailResponse create(CourseRequest request) {
    Course course =
        courseRepository.save(
            new Course(
                request.title().trim(),
                request.category().trim(),
                blankToNull(request.description())));
    return AdminCourseDetailResponse.of(course, List.of());
  }

  /** 과정 정보를 바꾼다. 종료된 과정이면 409다 (D-32). */
  public AdminCourseDetailResponse update(Long id, CourseRequest request) {
    Course course = findCourse(id);
    course.update(
        request.title().trim(), request.category().trim(), blankToNull(request.description()));
    return toDetail(course);
  }

  /** 과정을 종료하고 모집 중인 회차를 모두 마감한다 (D-31). 이미 종료됐으면 409다 (D-32). */
  public AdminCourseDetailResponse close(Long id) {
    Course course = findCourse(id);
    course.close();
    courseSessionRepository
        .findByCourseIdAndStatusOrderByStartDateAscIdAsc(id, CourseSessionStatus.OPEN)
        .forEach(CourseSession::close);
    return toDetail(course);
  }

  /** 회차를 추가한다. 새 회차는 모집 중(OPEN)이다. 종료된 과정이면 409다 (D-32). */
  public AdminSessionResponse createSession(Long courseId, SessionRequest request) {
    Course course = findCourse(courseId);
    course.requireOpen();
    CourseSession session =
        courseSessionRepository.save(
            new CourseSession(
                course, request.startDate(), request.place().trim(), request.capacity()));
    return AdminSessionResponse.from(session);
  }

  /** 회차의 일정·장소·정원을 바꾼다. 마감된 회차면 409다 (D-13, D-32). */
  public AdminSessionResponse updateSession(Long courseId, Long sessionId, SessionRequest request) {
    CourseSession session = findSession(courseId, sessionId);
    session.update(request.startDate(), request.place().trim(), request.capacity());
    return AdminSessionResponse.from(session);
  }

  /** 회차 모집을 마감한다 (D-04, D-11). 이미 마감됐으면 409다 (D-32). */
  public AdminSessionResponse closeSession(Long courseId, Long sessionId) {
    CourseSession session = findSession(courseId, sessionId);
    session.close();
    return AdminSessionResponse.from(session);
  }

  private Course findCourse(Long id) {
    return courseRepository.findById(id).orElseThrow(() -> new CourseNotFoundException(id));
  }

  private CourseSession findSession(Long courseId, Long sessionId) {
    return courseSessionRepository
        .findByIdAndCourseId(sessionId, courseId)
        .orElseThrow(() -> new CourseSessionNotFoundException(courseId, sessionId));
  }

  private AdminCourseDetailResponse toDetail(Course course) {
    List<AdminSessionResponse> sessions =
        courseSessionRepository.findByCourseIdOrderByStartDateAscIdAsc(course.getId()).stream()
            .map(AdminSessionResponse::from)
            .toList();
    return AdminCourseDetailResponse.of(course, sessions);
  }

  private static String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}
