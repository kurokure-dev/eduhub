package com.example.eduhub.enrollment.service;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.service.SessionLockService;
import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.EnrollmentResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 신청 취소와 대기 1순위 승급 (FR-06, D-01, D-52). 회차 행 락 아래에서 처리한다 (D-29). 마감된 회차는 취소할 수 없다 (D-02). */
@Service
@Transactional
public class EnrollmentCancelService {

  private final SessionLockService sessionLockService;
  private final EnrollmentRepository enrollmentRepository;

  public EnrollmentCancelService(
      SessionLockService sessionLockService, EnrollmentRepository enrollmentRepository) {
    this.sessionLockService = sessionLockService;
    this.enrollmentRepository = enrollmentRepository;
  }

  public EnrollmentResponse cancel(Long enrollmentId, String employeeNo) {
    // 주의: lock 전에 신청·회차 엔티티를 읽지 않는다. 회차 id만 투영 쿼리로 찾는다 (NFR-01).
    // 본인 신청이 아니면 없는 신청과 같이 404다 (D-45)
    Long sessionId =
        enrollmentRepository
            .findSessionIdByIdAndEmployeeId(enrollmentId, employeeNo.trim())
            .orElseThrow(() -> new EnrollmentNotFoundException(enrollmentId));

    CourseSession session = sessionLockService.lock(sessionId);
    if (!session.isOpen()) {
      throw new SessionClosedException(sessionId);
    }

    // 락 뒤에 읽어 다른 트랜잭션이 바꾼 최신 상태를 본다
    Enrollment enrollment =
        enrollmentRepository
            .findById(enrollmentId)
            .orElseThrow(() -> new EnrollmentNotFoundException(enrollmentId));
    EnrollmentStatus before = enrollment.getStatus();
    if (before != EnrollmentStatus.CONFIRMED && before != EnrollmentStatus.WAITING) {
      throw new EnrollmentNotCancellableException(enrollmentId, before);
    }

    enrollment.cancel();
    if (before == EnrollmentStatus.CONFIRMED) {
      session.releaseSeat();
      enrollmentRepository
          .findFirstBySessionIdAndStatusOrderByWaitingOrderAsc(sessionId, EnrollmentStatus.WAITING)
          .ifPresent(
              next -> {
                next.promote();
                session.occupySeat();
              });
    }
    return EnrollmentResponse.from(enrollment, null);
  }
}
