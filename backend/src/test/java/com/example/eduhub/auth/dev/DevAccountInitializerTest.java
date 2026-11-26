package com.example.eduhub.auth.dev;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.repository.EmployeeRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

class DevAccountInitializerTest {

  private final EmployeeRepository repository = mock(EmployeeRepository.class);
  private final PasswordEncoder encoder =
      PasswordEncoderFactories.createDelegatingPasswordEncoder();

  @Test
  @DisplayName("비밀번호가 비면 아무것도 저장하지 않는다")
  void blankPasswordSkips() {
    new DevAccountInitializer(repository, encoder, "").run(null);
    new DevAccountInitializer(repository, encoder, "  ").run(null);

    verify(repository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("이미 있는 사번은 건너뛴다")
  void existingEmployeeNoIsSkipped() {
    when(repository.existsByEmployeeNo("DEV-E001")).thenReturn(true);

    new DevAccountInitializer(repository, encoder, UUID.randomUUID().toString()).run(null);

    ArgumentCaptor<Employee> captor = ArgumentCaptor.forClass(Employee.class);
    verify(repository, times(2)).saveAndFlush(captor.capture());
    assertThat(captor.getAllValues())
        .extracting(Employee::getEmployeeNo)
        .containsExactly("DEV-E002", "DEV-A001");
  }

  @Test
  @DisplayName("없으면 3개를 저장하고 해시는 평문과 다르며 비밀번호와 맞는다")
  void createsThreeAccounts() {
    String password = UUID.randomUUID().toString();

    new DevAccountInitializer(repository, encoder, password).run(null);

    ArgumentCaptor<Employee> captor = ArgumentCaptor.forClass(Employee.class);
    verify(repository, times(3)).saveAndFlush(captor.capture());
    List<Employee> saved = captor.getAllValues();
    assertThat(saved)
        .extracting(Employee::getEmployeeNo, Employee::getRole)
        .containsExactly(
            tuple("DEV-E001", Role.EMPLOYEE),
            tuple("DEV-E002", Role.EMPLOYEE),
            tuple("DEV-A001", Role.ADMIN));
    for (Employee e : saved) {
      assertThat(e.getPasswordHash()).isNotEqualTo(password);
      assertThat(encoder.matches(password, e.getPasswordHash())).isTrue();
    }
  }

  @Test
  @DisplayName("NFR-03 비밀번호가 UTF-8 73바이트면 저장하지 않고, 72바이트면 저장한다")
  void tooLongPasswordSkips() {
    new DevAccountInitializer(repository, encoder, "a".repeat(73)).run(null);
    verify(repository, never()).saveAndFlush(any());

    new DevAccountInitializer(repository, encoder, "a".repeat(72)).run(null);
    verify(repository, times(3)).saveAndFlush(any());
  }

  @Test
  @DisplayName("저장 중 유일 제약 위반이 나도 예외 없이 나머지 계정을 계속 저장한다")
  void uniqueViolationIsSkipped() {
    when(repository.saveAndFlush(any()))
        .thenThrow(new DataIntegrityViolationException("dup"))
        .thenAnswer(inv -> inv.getArgument(0));

    new DevAccountInitializer(repository, encoder, UUID.randomUUID().toString()).run(null);

    verify(repository, times(3)).saveAndFlush(any());
  }
}
