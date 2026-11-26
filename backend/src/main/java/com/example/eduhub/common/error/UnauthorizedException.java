package com.example.eduhub.common.error;

/** 인증되지 않았거나 토큰이 유효하지 않을 때 던진다. GlobalExceptionHandler가 401로 바꾼다. */
public class UnauthorizedException extends RuntimeException {

  public UnauthorizedException(String message) {
    super(message);
  }
}
