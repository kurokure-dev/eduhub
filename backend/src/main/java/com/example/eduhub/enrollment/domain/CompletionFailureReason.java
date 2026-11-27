package com.example.eduhub.enrollment.domain;

/** 수료 처리에 실패한 사유 (D-48). */
public enum CompletionFailureReason {
  /** 대기 중이라 수료할 수 없다 (D-03). */
  WAITING,
  /** 그 회차에 신청이 없거나 취소된 신청만 있다. */
  NOT_ENROLLED,
  /** 이미 수료 처리됐다. */
  ALREADY_COMPLETED
}
