package com.example.eduhub.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.domain.CourseStateException;
import com.example.eduhub.course.domain.CourseStatus;
import com.example.eduhub.course.dto.admin.AdminCourseDetailResponse;
import com.example.eduhub.course.dto.admin.AdminSessionResponse;
import com.example.eduhub.course.dto.admin.CourseRequest;
import com.example.eduhub.course.dto.admin.SessionRequest;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminCourseServiceTest {

  @Mock private CourseRepository courseRepository;
  @Mock private CourseSessionRepository courseSessionRepository;
  @InjectMocks private AdminCourseService service;

  private static final SessionRequest SESSION_REQUEST =
      new SessionRequest(LocalDate.of(2026, 12, 1), " 본사 3층 ", 30);

  @Test
  @DisplayName("등록할 때 앞뒤 공백을 지우고, 빈 설명은 null로 저장한다")
  void createTrimsInput() {
    given(courseRepository.save(any(Course.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    AdminCourseDetailResponse response =
        service.create(new CourseRequest(" Spring 입문 ", " 개발 ", "  "));

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository).save(captor.capture());
    assertThat(captor.getValue().getTitle()).isEqualTo("Spring 입문");
    assertThat(captor.getValue().getCategory()).isEqualTo("개발");
    assertThat(captor.getValue().getDescription()).isNull();
    assertThat(response.status()).isEqualTo(CourseStatus.OPEN);
    assertThat(response.sessions()).isEmpty();
  }

  @Test
  @DisplayName("없는 과정을 수정하면 404 예외다")
  void updateNotFound() {
    given(courseRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.update(1L, new CourseRequest("a", "b", null)))
        .isInstanceOf(CourseNotFoundException.class);
  }

  @Test
  @DisplayName("과정을 수정하면 제목·분류·설명이 바뀐다")
  void update() {
    Course course = new Course("Spring 입문", "개발", null);
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));

    service.update(1L, new CourseRequest("JPA 심화", "백엔드", "설명"));

    assertThat(course.getTitle()).isEqualTo("JPA 심화");
    assertThat(course.getCategory()).isEqualTo("백엔드");
    assertThat(course.getDescription()).isEqualTo("설명");
  }

  @Test
  @DisplayName("종료된 과정은 수정할 수 없다 (D-32)")
  void updateClosedCourse() {
    Course course = closedCourse();
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));

    assertThatThrownBy(() -> service.update(1L, new CourseRequest("JPA 심화", "개발", null)))
        .isInstanceOf(CourseStateException.class);
    assertThat(course.getTitle()).isEqualTo("Spring 입문");
  }

  @Test
  @DisplayName("과정을 종료하면 모집 중인 회차도 모두 마감한다 (D-31)")
  void closeCourseClosesOpenSessions() {
    Course course = new Course("Spring 입문", "개발", null);
    CourseSession first = new CourseSession(course, LocalDate.of(2026, 12, 1), "본사", 20);
    CourseSession second = new CourseSession(course, LocalDate.of(2026, 12, 8), "본사", 20);
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));
    given(
            courseSessionRepository.findByCourseIdAndStatusOrderByStartDateAscIdAsc(
                1L, CourseSessionStatus.OPEN))
        .willReturn(List.of(first, second));

    service.close(1L);

    assertThat(course.getStatus()).isEqualTo(CourseStatus.CLOSED);
    assertThat(first.getStatus()).isEqualTo(CourseSessionStatus.CLOSED);
    assertThat(second.getStatus()).isEqualTo(CourseSessionStatus.CLOSED);
  }

  @Test
  @DisplayName("이미 종료된 과정을 다시 종료할 수 없다 (D-32)")
  void closeClosedCourse() {
    given(courseRepository.findById(1L)).willReturn(Optional.of(closedCourse()));

    assertThatThrownBy(() -> service.close(1L)).isInstanceOf(CourseStateException.class);
  }

  @Test
  @DisplayName("회차를 추가하면 모집 중 상태로 저장한다")
  void createSession() {
    Course course = new Course("Spring 입문", "개발", null);
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));
    given(courseSessionRepository.save(any(CourseSession.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    AdminSessionResponse response = service.createSession(1L, SESSION_REQUEST);

    assertThat(response.place()).isEqualTo("본사 3층");
    assertThat(response.capacity()).isEqualTo(30);
    assertThat(response.status()).isEqualTo(CourseSessionStatus.OPEN);
  }

  @Test
  @DisplayName("종료된 과정에는 회차를 추가할 수 없다 (D-32)")
  void createSessionOnClosedCourse() {
    given(courseRepository.findById(1L)).willReturn(Optional.of(closedCourse()));

    assertThatThrownBy(() -> service.createSession(1L, SESSION_REQUEST))
        .isInstanceOf(CourseStateException.class);
    verify(courseSessionRepository, never()).save(any());
  }

  @Test
  @DisplayName("모집 중인 회차는 일정·장소·정원을 바꿀 수 있다 (D-33: 정원 값만 바뀐다)")
  void updateSession() {
    CourseSession session = openSession();
    given(courseSessionRepository.findByIdAndCourseId(10L, 1L)).willReturn(Optional.of(session));

    service.updateSession(1L, 10L, SESSION_REQUEST);

    assertThat(session.getStartDate()).isEqualTo(LocalDate.of(2026, 12, 1));
    assertThat(session.getPlace()).isEqualTo("본사 3층");
    assertThat(session.getCapacity()).isEqualTo(30);
  }

  @Test
  @DisplayName("마감된 회차는 정원을 바꿀 수 없다 (D-13)")
  void updateClosedSession() {
    CourseSession session = openSession();
    session.close();
    given(courseSessionRepository.findByIdAndCourseId(10L, 1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.updateSession(1L, 10L, SESSION_REQUEST))
        .isInstanceOf(CourseStateException.class);
    assertThat(session.getCapacity()).isEqualTo(20);
  }

  @Test
  @DisplayName("다른 과정의 회차는 찾을 수 없다")
  void sessionOfOtherCourse() {
    given(courseSessionRepository.findByIdAndCourseId(10L, 2L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.closeSession(2L, 10L))
        .isInstanceOf(CourseSessionNotFoundException.class);
  }

  @Test
  @DisplayName("회차를 마감하고, 이미 마감된 회차는 다시 마감할 수 없다 (D-04, D-32)")
  void closeSession() {
    CourseSession session = openSession();
    given(courseSessionRepository.findByIdAndCourseId(10L, 1L)).willReturn(Optional.of(session));

    AdminSessionResponse response = service.closeSession(1L, 10L);

    assertThat(response.status()).isEqualTo(CourseSessionStatus.CLOSED);
    assertThatThrownBy(() -> service.closeSession(1L, 10L))
        .isInstanceOf(CourseStateException.class);
  }

  private static Course closedCourse() {
    Course course = new Course("Spring 입문", "개발", null);
    course.close();
    return course;
  }

  private static CourseSession openSession() {
    return new CourseSession(
        new Course("Spring 입문", "개발", null), LocalDate.of(2026, 11, 1), "별관", 20);
  }
}
