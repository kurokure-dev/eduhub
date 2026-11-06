package com.example.eduhub.course.dto;

import com.example.eduhub.course.domain.Course;
import java.util.List;

/** 과정 상세와 모집 중인 회차 (FR-02, D-19). */
public record CourseDetailResponse(
    Long id, String title, String category, String description, List<SessionResponse> sessions) {

  public static CourseDetailResponse of(Course course, List<SessionResponse> sessions) {
    return new CourseDetailResponse(
        course.getId(), course.getTitle(), course.getCategory(), course.getDescription(), sessions);
  }
}
