package com.example.eduhub.enrollment.service;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.enrollment.domain.EnrollmentStatus;

/** 확정·대기가 아닌 신청(수료, 이미 취소)을 취소할 때 던진다 (D-52). */
public class EnrollmentNotCancellableException extends ConflictException {

  public EnrollmentNotCancellableException(Long enrollmentId, EnrollmentStatus status) {
    super("취소할 수 없는 신청입니다: " + enrollmentId + " (" + status + ")");
  }
}
