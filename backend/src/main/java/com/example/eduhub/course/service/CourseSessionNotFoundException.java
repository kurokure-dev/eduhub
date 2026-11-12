package com.example.eduhub.course.service;

import com.example.eduhub.common.error.NotFoundException;

/** 회차가 없거나 다른 과정의 회차일 때 던진다. */
public class CourseSessionNotFoundException extends NotFoundException {

  public CourseSessionNotFoundException(Long sessionId) {
    super("회차를 찾을 수 없습니다: 회차 " + sessionId);
  }

  public CourseSessionNotFoundException(Long courseId, Long sessionId) {
    super("회차를 찾을 수 없습니다: 과정 " + courseId + ", 회차 " + sessionId);
  }
}
