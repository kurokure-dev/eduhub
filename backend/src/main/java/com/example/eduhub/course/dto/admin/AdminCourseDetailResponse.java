package com.example.eduhub.course.dto.admin;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseStatus;
import java.util.List;

/** 관리자 과정 상세. 상태와 관계없이 모든 회차를 일정순으로 담는다 (D-34). */
public record AdminCourseDetailResponse(
    Long id,
    String title,
    String category,
    String description,
    CourseStatus status,
    List<AdminSessionResponse> sessions) {

  public static AdminCourseDetailResponse of(Course course, List<AdminSessionResponse> sessions) {
    return new AdminCourseDetailResponse(
        course.getId(),
        course.getTitle(),
        course.getCategory(),
        course.getDescription(),
        course.getStatus(),
        sessions);
  }
}
