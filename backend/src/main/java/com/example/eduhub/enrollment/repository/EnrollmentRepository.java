package com.example.eduhub.enrollment.repository;

import com.example.eduhub.enrollment.domain.Enrollment;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import java.util.Collection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

  boolean existsBySessionIdAndEmployeeIdAndStatusIn(
      Long sessionId, String employeeId, Collection<EnrollmentStatus> statuses);

  boolean existsBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);
}
