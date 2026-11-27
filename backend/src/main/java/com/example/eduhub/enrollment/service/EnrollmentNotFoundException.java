package com.example.eduhub.enrollment.service;

import com.example.eduhub.common.error.NotFoundException;

/** 신청이 없거나 본인 신청이 아닐 때 던진다. 남의 신청 존재를 숨기려고 둘 다 404다 (D-45). */
public class EnrollmentNotFoundException extends NotFoundException {

  public EnrollmentNotFoundException(Long enrollmentId) {
    super("신청을 찾을 수 없습니다: " + enrollmentId);
  }
}
