package com.example.eduhub.course.repository;

import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseSessionRepository extends JpaRepository<CourseSession, Long> {

  /** 과정의 회차를 상태로 골라 일정순으로 조회한다 (D-19, D-21). */
  List<CourseSession> findByCourseIdAndStatusOrderByStartDateAscIdAsc(
      Long courseId, CourseSessionStatus status);

  /** 과정의 모든 회차를 일정순으로 조회한다. 관리자 상세에서 쓴다 (D-34). */
  List<CourseSession> findByCourseIdOrderByStartDateAscIdAsc(Long courseId);

  /** 회차 행을 비관적 락으로 조회한다. 호출자 트랜잭션이 끝날 때까지 락이 유지된다 (D-29, NFR-01). */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from CourseSession s where s.id = :id")
  Optional<CourseSession> findByIdForUpdate(@Param("id") Long id);

  /** 과정에 속한 회차 하나를 락을 잡고 조회한다. 다른 과정의 회차면 비어 있다 (D-29). */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from CourseSession s where s.id = :id and s.course.id = :courseId")
  Optional<CourseSession> findByIdAndCourseIdForUpdate(
      @Param("id") Long id, @Param("courseId") Long courseId);

  /** 과정의 회차를 상태로 골라 id 순서로 락을 잡고 조회한다. id 순서로 잡아 교착을 피한다 (D-29). */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "select s from CourseSession s where s.course.id = :courseId and s.status = :status"
          + " order by s.id")
  List<CourseSession> findByCourseIdAndStatusForUpdate(
      @Param("courseId") Long courseId, @Param("status") CourseSessionStatus status);
}
