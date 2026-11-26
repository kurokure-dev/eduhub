package com.example.eduhub.auth.service;

import com.example.eduhub.common.error.UnauthorizedException;

/** 사번이 없거나 비밀번호가 틀렸을 때. 어느 쪽인지 드러내지 않는다 (D-42). */
public class InvalidCredentialsException extends UnauthorizedException {

  public InvalidCredentialsException() {
    super("사번 또는 비밀번호가 올바르지 않습니다.");
  }
}
