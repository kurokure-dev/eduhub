package com.example.eduhub.course.repository;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseStatus;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseRepository extends JpaRepository<Course, Long> {

  /**
   * 과정 목록 검색 (FR-01, D-18). 제목은 부분 일치, 분류는 정확히 일치이며 null인 조건은 적용하지 않는다.
   *
   * <p>Course에는 연관관계가 없으므로 페이지 조회와 count 조회 두 번으로 끝난다 (NFR-02).
   */
  @Query(
      """
      select c from Course c
      where c.status = :status
        and (:keyword is null or c.title like concat('%', :keyword, '%'))
        and (:category is null or c.category = :category)
      """)
  Page<Course> search(
      @Param("status") CourseStatus status,
      @Param("keyword") String keyword,
      @Param("category") String category,
      Pageable pageable);

  /** 해당 상태인 과정의 분류를 중복 없이 이름순으로 조회한다 (D-23). */
  @Query("select distinct c.category from Course c where c.status = :status order by c.category")
  List<String> findCategories(@Param("status") CourseStatus status);

  /** 관리자 과정 목록 검색 (D-34). 종료된 과정도 포함하며, status·keyword·category 중 null인 조건은 적용하지 않는다. */
  @Query(
      """
      select c from Course c
      where (:status is null or c.status = :status)
        and (:keyword is null or c.title like concat('%', :keyword, '%'))
        and (:category is null or c.category = :category)
      """)
  Page<Course> adminSearch(
      @Param("status") CourseStatus status,
      @Param("keyword") String keyword,
      @Param("category") String category,
      Pageable pageable);
}
