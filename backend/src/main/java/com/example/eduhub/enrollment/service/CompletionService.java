package com.example.eduhub.enrollment.service;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.service.SessionLockService;
import com.example.eduhub.enrollment.domain.CompletionFailureReason;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.CompletionFailure;
import com.example.eduhub.enrollment.dto.CompletionResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 수료 처리 (FR-08, D-03, D-47, D-48). 회차 행 락으로 같은 회차의 신청·취소와 직렬화한다 (D-29). */
@Service
@Transactional
public class CompletionService {

  private final SessionLockService sessionLockService;
  private final EnrollmentRepository enrollmentRepository;
  private final Clock clock;

  public CompletionService(
      SessionLockService sessionLockService,
      EnrollmentRepository enrollmentRepository,
      Clock clock) {
    this.sessionLockService = sessionLockService;
    this.enrollmentRepository = enrollmentRepository;
    this.clock = clock;
  }

  public CompletionResponse complete(Long sessionId, List<String> employeeIds) {
    // 주의: lock 전에 회차 엔티티를 조회하지 않는다 (EnrollmentService와 같은 이유, NFR-01)
    CourseSession session = sessionLockService.lock(sessionId);

    // D-47: 시작일 당일부터 수료할 수 있다. 마감 여부는 보지 않는다
    if (LocalDate.now(clock).isBefore(session.getStartDate())) {
      throw new SessionNotStartedException(sessionId);
    }

    // D-48: 사번은 trim 후 대소문자를 무시해 비교한다 (DB 콜레이션과 같다).
    // 중복은 처음 나온 입력 원문만 남기고 입력 순서를 유지한다
    Set<String> seen = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    List<String> ids = new ArrayList<>();
    for (String id : employeeIds) {
      String trimmed = id.trim();
      if (seen.add(trimmed)) {
        ids.add(trimmed);
      }
    }

    Map<String, List<Enrollment>> byEmployee = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    for (Enrollment e : enrollmentRepository.findBySessionIdAndEmployeeIdIn(sessionId, ids)) {
      byEmployee.computeIfAbsent(e.getEmployeeId(), k -> new ArrayList<>()).add(e);
    }

    List<String> completed = new ArrayList<>();
    List<CompletionFailure> failed = new ArrayList<>();
    for (String id : ids) {
      List<Enrollment> rows = byEmployee.getOrDefault(id, List.of());
      Enrollment confirmed = find(rows, EnrollmentStatus.CONFIRMED);
      if (confirmed != null) {
        confirmed.complete(); // 저장은 dirty checking. confirmed_count는 유지한다 (D-48)
        completed.add(id);
      } else if (find(rows, EnrollmentStatus.WAITING) != null) {
        failed.add(new CompletionFailure(id, CompletionFailureReason.WAITING));
      } else if (find(rows, EnrollmentStatus.COMPLETED) != null) {
        failed.add(new CompletionFailure(id, CompletionFailureReason.ALREADY_COMPLETED));
      } else {
        failed.add(new CompletionFailure(id, CompletionFailureReason.NOT_ENROLLED));
      }
    }
    return new CompletionResponse(completed, failed);
  }

  private static Enrollment find(List<Enrollment> rows, EnrollmentStatus status) {
    return rows.stream().filter(e -> e.getStatus() == status).findFirst().orElse(null);
  }
}
