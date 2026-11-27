package com.example.eduhub.enrollment.service;

import com.example.eduhub.enrollment.domain.EnrollmentStatus;
import com.example.eduhub.enrollment.dto.MyEnrollmentResponse;
import com.example.eduhub.enrollment.repository.EnrollmentRepository;
import java.util.List;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 내 신청 내역 조회 (FR-07, D-09). */
@Service
@Transactional(readOnly = true)
public class MyEnrollmentQueryService {

  private final EnrollmentRepository enrollmentRepository;

  public MyEnrollmentQueryService(EnrollmentRepository enrollmentRepository) {
    this.enrollmentRepository = enrollmentRepository;
  }

  /** 최근 신청순. status가 null이면 전체. */
  public List<MyEnrollmentResponse> findMine(String employeeNo, @Nullable EnrollmentStatus status) {
    return enrollmentRepository.findMine(employeeNo, status);
  }
}
