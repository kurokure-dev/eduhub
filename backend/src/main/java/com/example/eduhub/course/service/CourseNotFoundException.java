package com.example.eduhub.course.service;

import com.example.eduhub.common.error.NotFoundException;

/** 과정이 없거나 종료됐을 때 던진다 (D-20). */
public class CourseNotFoundException extends NotFoundException {

  public CourseNotFoundException(Long id) {
    super("과정을 찾을 수 없습니다: " + id);
  }
}
