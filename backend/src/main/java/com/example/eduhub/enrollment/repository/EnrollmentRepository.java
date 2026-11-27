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

  /** 회차의 지정한 사번들의 신청 전부 (취소 포함). 수료 처리용 (D-48). */
  List<Enrollment> findBySessionIdAndEmployeeIdIn(Long sessionId, Collection<String> employeeIds);

  /** 본인 신청의 회차 id만 읽는다. 락 전에 엔티티를 영속성 컨텍스트에 올리지 않기 위한 투영 쿼리다 (D-51, D-45). */
  @Query("select e.session.id from Enrollment e where e.id = :id and e.employeeId = :employeeNo")
  Optional<Long> findSessionIdByIdAndEmployeeId(
      @Param("id") Long id, @Param("employeeNo") String employeeNo);

  /** 승급 대상: 회차 대기 중 정렬 키가 가장 작은 신청 (D-01). 회차 행 락을 잡은 뒤에만 호출한다. */
  Optional<Enrollment> findFirstBySessionIdAndStatusOrderByWaitingOrderAsc(
      Long sessionId, EnrollmentStatus status);

  long countBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);

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

  /** 명단 조회용 회차 요약 (FR-08). 없으면 비어 있다. */
  @Query(
      """
      select new com.example.eduhub.enrollment.repository.RosterSessionSummary(
        s.id, c.title, s.startDate, s.capacity, s.status)
      from CourseSession s join s.course c
      where s.id = :sessionId
      """)
  Optional<RosterSessionSummary> findRosterSummary(@Param("sessionId") Long sessionId);

  /** 명단 조회용 신청 행 (FR-08, D-48). 계정이 없는 사번도 name null로 나온다. */
  @Query(
      """
      select new com.example.eduhub.enrollment.repository.RosterRow(
        e.id, e.employeeId, emp.name, e.status, e.waitingOrder, e.appliedAt)
      from Enrollment e
        left join Employee emp on emp.employeeNo = e.employeeId
      where e.session.id = :sessionId and e.status in :statuses
      order by e.appliedAt, e.id
      """)
  List<RosterRow> findRosterRows(
      @Param("sessionId") Long sessionId, @Param("statuses") Collection<EnrollmentStatus> statuses);
}
