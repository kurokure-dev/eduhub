package com.example.eduhub.course.service;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.repository.CourseSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회차 행 락을 다른 도메인(enrollment)에 제공한다 (D-29, NFR-01, NFR-07).
 *
 * <p>락은 호출자 트랜잭션이 끝날 때까지 유지돼야 하므로 트랜잭션 없이 부르면 예외가 난다 (MANDATORY).
 */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class SessionLockService {

  private final CourseSessionRepository courseSessionRepository;

  public SessionLockService(CourseSessionRepository courseSessionRepository) {
    this.courseSessionRepository = courseSessionRepository;
  }

  /** 회차 행을 비관적 락으로 잡는다 (D-29). 없으면 404 예외다. */
  public CourseSession lock(Long sessionId) {
    return courseSessionRepository
        .findByIdForUpdate(sessionId)
        .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));
  }
}
