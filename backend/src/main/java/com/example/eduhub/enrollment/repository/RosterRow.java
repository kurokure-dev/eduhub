package com.example.eduhub.enrollment.repository;

import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import java.time.LocalDateTime;

/** 명단 조회용 신청 행. name이 null이면 employee 계정이 없는 사번이다 (D-48). 내부용. */
public record RosterRow(
    Long enrollmentId,
    String employeeNo,
    String name,
    EnrollmentStatus status,
    Long waitingOrder,
    LocalDateTime appliedAt) {}
