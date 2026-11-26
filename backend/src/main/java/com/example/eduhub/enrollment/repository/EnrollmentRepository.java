package com.example.eduhub.enrollment.repository;

import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.MyEnrollmentResponse;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.Nullable;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

  boolean existsBySessionIdAndEmployeeIdAndStatusIn(
      Long sessionId, String employeeId, Collection<EnrollmentStatus> statuses);

  boolean existsBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);

  /** 회차의 대기 정렬 키 최대값 (D-46). 회차 행 락을 잡은 뒤에만 호출한다. */
  @Query("select max(e.waitingOrder) from Enrollment e where e.session.id = :sessionId")
  Optional<Long> findMaxWaitingOrder(@Param("sessionId") Long sessionId);

  /** 내 신청 내역 (FR-07). 대기 순번은 같은 회차의 대기 중 내 키 이하의 개수다 (D-39). */
  @Query(
      """
      select new com.example.eduhub.enrollment.dto.MyEnrollmentResponse(
        e.id, s.id, c.title, s.startDate, s.place, e.status,
        case when e.status = com.example.eduhub.enrollment.domain.EnrollmentStatus.WAITING
             then (select count(w) from Enrollment w
                   where w.session = s
                     and w.status = com.example.eduhub.enrollment.domain.EnrollmentStatus.WAITING
                     and w.waitingOrder <= e.waitingOrder)
        end,
        e.appliedAt)
      from Enrollment e join e.session s join s.course c
      where e.employeeId = :employeeNo
        and (:status is null or e.status = :status)
      order by e.appliedAt desc, e.id desc
      """)
  List<MyEnrollmentResponse> findMine(
      @Param("employeeNo") String employeeNo, @Param("status") @Nullable EnrollmentStatus status);
}
