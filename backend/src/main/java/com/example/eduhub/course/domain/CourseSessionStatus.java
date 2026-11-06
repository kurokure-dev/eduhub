package com.example.eduhub.course.domain;

/** 회차 상태. 회차의 "종료"는 모집 마감이다 (D-11). */
public enum CourseSessionStatus {
  /** 모집 중. */
  OPEN,
  /** 모집 마감. 신청할 수 없다 (D-04). */
  CLOSED
}
