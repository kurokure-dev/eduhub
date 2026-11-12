package com.example.eduhub.course.domain;

import com.example.eduhub.common.error.ConflictException;

/** 종료된 과정이나 마감된 회차를 바꾸려 할 때 던진다 (D-32). */
public class CourseStateException extends ConflictException {

  public CourseStateException(String message) {
    super(message);
  }
}
