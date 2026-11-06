package com.example.eduhub.course.repository;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseSessionRepository extends JpaRepository<CourseSession, Long> {

  /** 과정의 회차를 상태로 골라 일정순으로 조회한다 (D-19, D-21). */
  List<CourseSession> findByCourseIdAndStatusOrderByStartDateAscIdAsc(
      Long courseId, CourseSessionStatus status);
}
