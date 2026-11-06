package com.example.eduhub.course.dto;

import com.example.eduhub.course.domain.CourseSession;
import java.time.LocalDate;

/** 과정 상세의 회차 (FR-02). */
public record SessionResponse(
    Long id, LocalDate startDate, String place, int capacity, int remainingSeats) {

  public static SessionResponse from(CourseSession session) {
    // D-16: 신청 기능이 생기기 전까지 남은 자리는 정원과 같다
    return new SessionResponse(
        session.getId(),
        session.getStartDate(),
        session.getPlace(),
        session.getCapacity(),
        session.getCapacity());
  }
}
