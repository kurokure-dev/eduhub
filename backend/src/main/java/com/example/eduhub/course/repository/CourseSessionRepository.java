package com.example.eduhub.course.repository;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseSessionRepository extends JpaRepository<CourseSession, Long> {

  /** 과정의 회차를 상태로 골라 일정순으로 조회한다 (D-19, D-21). */
  List<CourseSession> findByCourseIdAndStatusOrderByStartDateAscIdAsc(
      Long courseId, CourseSessionStatus status);

  /** 과정의 모든 회차를 일정순으로 조회한다. 관리자 상세에서 쓴다 (D-34). */
  List<CourseSession> findByCourseIdOrderByStartDateAscIdAsc(Long courseId);

  /** 과정에 속한 회차 하나를 조회한다. 다른 과정의 회차면 비어 있다. */
  Optional<CourseSession> findByIdAndCourseId(Long id, Long courseId);
}
