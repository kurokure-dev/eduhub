package com.example.eduhub.enrollment.service;

import com.example.eduhub.course.service.CourseSessionNotFoundException;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.RosterConfirmedEntry;
import com.example.eduhub.enrollment.dto.RosterResponse;
import com.example.eduhub.enrollment.dto.RosterWaitingEntry;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import com.example.eduhub.enrollment.repository.RosterRow;
import com.example.eduhub.enrollment.repository.RosterSessionSummary;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 회차 명단 조회 (FR-08, D-39, D-48). */
@Service
@Transactional(readOnly = true)
public class RosterService {

  private final EnrollmentRepository enrollmentRepository;

  public RosterService(EnrollmentRepository enrollmentRepository) {
    this.enrollmentRepository = enrollmentRepository;
  }

  public RosterResponse getRoster(Long sessionId) {
    RosterSessionSummary summary =
        enrollmentRepository
            .findRosterSummary(sessionId)
            .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));
    List<RosterRow> rows =
        enrollmentRepository.findRosterRows(
            sessionId,
            Set.of(
                EnrollmentStatus.CONFIRMED, EnrollmentStatus.COMPLETED, EnrollmentStatus.WAITING));

    // 확정·수료는 조회 순서(신청순) 그대로
    List<RosterConfirmedEntry> confirmed = new ArrayList<>();
    List<RosterRow> waitingRows = new ArrayList<>();
    for (RosterRow row : rows) {
      if (row.status() == EnrollmentStatus.WAITING) {
        waitingRows.add(row);
      } else if (row.name() != null) {
        confirmed.add(
            new RosterConfirmedEntry(
                row.enrollmentId(), row.employeeNo(), row.name(), row.status(), row.appliedAt()));
      }
    }

    // 순번은 계정 없는 행을 빼기 전에 전체 대기 행에 매긴다 (D-39, D-48)
    // WAITING이면 waiting_order NOT NULL (V5 CHECK, D-46)
    waitingRows.sort(Comparator.comparing(RosterRow::waitingOrder));
    List<RosterWaitingEntry> waiting =
        IntStream.range(0, waitingRows.size())
            .filter(i -> waitingRows.get(i).name() != null)
            .mapToObj(
                i -> {
                  RosterRow row = waitingRows.get(i);
                  return new RosterWaitingEntry(
                      row.enrollmentId(), row.employeeNo(), row.name(), i + 1L, row.appliedAt());
                })
            .toList();

    return new RosterResponse(
        summary.sessionId(),
        summary.courseTitle(),
        summary.startDate(),
        summary.capacity(),
        summary.status(),
        confirmed,
        waiting);
  }
}
