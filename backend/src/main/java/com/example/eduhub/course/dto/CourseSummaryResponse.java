package com.example.eduhub.course.dto;

import com.example.eduhub.course.domain.Course;

/** 과정 목록의 한 줄 (FR-01). */
public record CourseSummaryResponse(Long id, String title, String category) {

  public static CourseSummaryResponse from(Course course) {
    return new CourseSummaryResponse(course.getId(), course.getTitle(), course.getCategory());
  }
}
