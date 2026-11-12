package com.example.eduhub.enrollment.service;

import com.example.eduhub.common.error.ConflictException;

/** 마감된 회차에 신청할 때 던진다 (D-04). */
public class SessionClosedException extends ConflictException {

  public SessionClosedException(Long sessionId) {
    super("마감된 회차에는 신청할 수 없습니다: " + sessionId);
  }
}
