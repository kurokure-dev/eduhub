package com.example.eduhub.enrollment.service;

import com.example.eduhub.common.error.ConflictException;

/** 회차 시작일 전에 수료 처리할 때 던진다 (D-47). */
public class SessionNotStartedException extends ConflictException {

  public SessionNotStartedException(Long sessionId) {
    super("회차 시작일 전에는 수료 처리할 수 없습니다: " + sessionId);
  }
}
