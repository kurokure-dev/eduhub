package com.example.eduhub.enrollment.repository;

import com.example.eduhub.course.domain.CourseSessionStatus;
import java.time.LocalDate;

/** 명단 조회용 회차 요약. 서비스 내부용이며 API에 내보내지 않는다. */
public record RosterSessionSummary(
    Long sessionId,
    String courseTitle,
    LocalDate startDate,
    int capacity,
    CourseSessionStatus status) {}
