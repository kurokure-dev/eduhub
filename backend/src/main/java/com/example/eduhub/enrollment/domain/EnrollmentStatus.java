package com.example.eduhub.enrollment.domain;

/** 신청 상태. V2 스키마의 {@code ck_enrollment_status}와 일치한다. */
public enum EnrollmentStatus {
  /** 정원 안에서 확정된 신청 (D-37). */
  CONFIRMED,
  /** 정원이 차서 대기 중인 신청 (FR-05). */
  WAITING,
  /** 취소된 신청. 취소 뒤 재신청은 새 행으로 한다 (D-07). */
  CANCELLED,
  /** 수료 처리된 신청 (FR-09). */
  COMPLETED
}
