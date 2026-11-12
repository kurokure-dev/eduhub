package com.example.eduhub.course.dto.admin;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import java.time.LocalDate;

/** 관리자 과정 상세의 회차. 마감된 회차도 나오므로 상태를 함께 준다 (D-34). */
public record AdminSessionResponse(
    Long id,
    LocalDate startDate,
    String place,
    int capacity,
    CourseSessionStatus status,
    int confirmedCount) {

  public static AdminSessionResponse from(CourseSession session) {
    return new AdminSessionResponse(
        session.getId(),
        session.getStartDate(),
        session.getPlace(),
        session.getCapacity(),
        session.getStatus(),
        session.getConfirmedCount());
  }
}
