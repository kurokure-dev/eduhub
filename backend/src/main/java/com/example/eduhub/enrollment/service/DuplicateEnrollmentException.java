package com.example.eduhub.enrollment.service;

import com.example.eduhub.common.error.ConflictException;

/** 같은 회차에 확정·대기 신청이 이미 있을 때 던진다 (FR-04, D-07). */
public class DuplicateEnrollmentException extends ConflictException {

  public DuplicateEnrollmentException(Long sessionId) {
    super("이미 신청한 회차입니다: 회차 " + sessionId);
  }
}
