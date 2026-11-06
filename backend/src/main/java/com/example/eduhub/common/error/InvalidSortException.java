package com.example.eduhub.common.error;

/** 허용하지 않은 필드로 정렬을 요청했을 때 던진다. GlobalExceptionHandler가 400으로 바꾼다. */
public class InvalidSortException extends RuntimeException {

  public InvalidSortException(String property) {
    super("정렬할 수 없는 필드입니다: " + property);
  }
}
