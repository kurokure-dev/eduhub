package com.example.eduhub.course.dto.admin;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseStatus;

/** 관리자 과정 목록의 한 줄. 종료된 과정도 나오므로 상태를 함께 준다 (D-34). */
public record AdminCourseSummaryResponse(
    Long id, String title, String category, CourseStatus status) {

  public static AdminCourseSummaryResponse from(Course course) {
    return new AdminCourseSummaryResponse(
        course.getId(), course.getTitle(), course.getCategory(), course.getStatus());
  }
}
