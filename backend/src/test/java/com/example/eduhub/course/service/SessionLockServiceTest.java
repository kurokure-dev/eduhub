package com.example.eduhub.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.repository.CourseSessionRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SessionLockServiceTest {

  @Mock private CourseSessionRepository courseSessionRepository;
  @InjectMocks private SessionLockService service;

  @Test
  @DisplayName("회차가 있으면 락을 잡고 반환한다 (D-29)")
  void lockReturnsSession() {
    CourseSession session =
        new CourseSession(new Course("Spring 입문", "개발", null), LocalDate.of(2026, 12, 1), "본사", 20);
    given(courseSessionRepository.findByIdForUpdate(10L)).willReturn(Optional.of(session));

    assertThat(service.lock(10L)).isSameAs(session);
  }

  @Test
  @DisplayName("회차가 없으면 404 예외다 (D-29)")
  void lockNotFound() {
    given(courseSessionRepository.findByIdForUpdate(10L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.lock(10L))
        .isInstanceOf(CourseSessionNotFoundException.class)
        .hasMessageContaining("회차 10");
  }
}
