package com.example.eduhub.enrollment.service;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.service.SessionLockService;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 수강 신청 (FR-04, NFR-01, D-35). 신청 한 건이 트랜잭션 하나이고, 회차 행 락으로 같은 회차 신청을 직렬화한다. */
@Service
@Transactional
public class EnrollmentService {

  private static final String ACTIVE_UNIQUE_INDEX = "ux_enrollment_active";

  private final SessionLockService sessionLockService;
  private final EnrollmentRepository enrollmentRepository;
  private final Clock clock;

  public EnrollmentService(
      SessionLockService sessionLockService,
      EnrollmentRepository enrollmentRepository,
      Clock clock) {
    this.sessionLockService = sessionLockService;
    this.enrollmentRepository = enrollmentRepository;
    this.clock = clock;
  }

  public EnrollmentResponse enroll(Long sessionId, String employeeId) {
    String trimmed = employeeId.trim();

    // 주의: lock 전에 같은 회차 엔티티를 조회하지 않는다. 이미 영속성 컨텍스트에 있으면
    // 락 쿼리가 낡은 confirmedCount를 덮어쓰지 않아 정원을 넘길 수 있다 (NFR-01).
    // lock이 이 트랜잭션에서 회차를 처음 읽는 지점이어야 한다.
    CourseSession session = sessionLockService.lock(sessionId);

    if (!session.isOpen()) {
      throw new SessionClosedException(sessionId);
    }
    if (enrollmentRepository.existsBySessionIdAndEmployeeIdAndStatusIn(
        sessionId, trimmed, List.of(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING))) {
      throw new DuplicateEnrollmentException(sessionId);
    }

    LocalDateTime now = LocalDateTime.now(clock);
    Enrollment enrollment;
    // 대기자가 있으면 빈자리가 있어도 새 신청자를 확정하지 않는다 (D-35)
    if (session.hasRemainingSeat()
        && !enrollmentRepository.existsBySessionIdAndStatus(sessionId, EnrollmentStatus.WAITING)) {
      session.occupySeat();
      enrollment = Enrollment.confirmed(session, trimmed, now);
    } else {
      enrollment = Enrollment.waiting(session, trimmed, now);
    }

    try {
      enrollmentRepository.saveAndFlush(enrollment);
    } catch (DataIntegrityViolationException e) {
      if (causedByActiveIndex(e)) {
        throw new DuplicateEnrollmentException(sessionId);
      }
      throw e;
    }
    return EnrollmentResponse.from(enrollment);
  }

  private static boolean causedByActiveIndex(Throwable e) {
    for (Throwable t = e; t != null; t = t.getCause()) {
      if (t.getMessage() != null && t.getMessage().contains(ACTIVE_UNIQUE_INDEX)) {
        return true;
      }
      if (t.getCause() == t) {
        break;
      }
    }
    return false;
  }
}
