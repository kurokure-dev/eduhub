package com.example.eduhub.common.error;

/** 자원의 현재 상태 때문에 요청을 처리할 수 없을 때 던진다. GlobalExceptionHandler가 409로 바꾼다. */
public class ConflictException extends RuntimeException {

  public ConflictException(String message) {
    super(message);
  }
}
