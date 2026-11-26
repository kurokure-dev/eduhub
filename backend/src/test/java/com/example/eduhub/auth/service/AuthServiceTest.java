package com.example.eduhub.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.dto.LoginResponse;
import com.example.eduhub.auth.repository.EmployeeRepository;
import com.example.eduhub.common.error.UnauthorizedException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

  private final EmployeeRepository employeeRepository = mock(EmployeeRepository.class);
  private final TokenService tokenService = mock(TokenService.class);
  private final PasswordEncoder passwordEncoder =
      PasswordEncoderFactories.createDelegatingPasswordEncoder();
  private AuthService authService;

  private String password;
  private String no;
  private Employee employee;

  @BeforeEach
  void setUp() {
    authService = new AuthService(employeeRepository, passwordEncoder, tokenService);
    password = UUID.randomUUID().toString();
    no = "T-" + UUID.randomUUID().toString().substring(0, 8);
    employee = new Employee(no, "테스트", passwordEncoder.encode(password), Role.EMPLOYEE);
  }

  @Test
  @DisplayName("D-42 올바른 사번·비밀번호면 토큰과 사용자 정보를 돌려준다")
  void loginSucceeds() {
    given(employeeRepository.findByEmployeeNo(no)).willReturn(Optional.of(employee));
    given(tokenService.issue(employee)).willReturn(new IssuedToken("tok", 3600));

    LoginResponse response = authService.login(no, password);

    assertThat(response.accessToken()).isEqualTo("tok");
    assertThat(response.tokenType()).isEqualTo("Bearer");
    assertThat(response.expiresIn()).isEqualTo(3600);
    assertThat(response.user().employeeNo()).isEqualTo(no);
    assertThat(response.user().role()).isEqualTo(Role.EMPLOYEE);
  }

  @Test
  @DisplayName("D-42 비밀번호가 틀리거나 사번이 없으면 같은 예외와 같은 메시지다")
  void wrongPasswordAndUnknownEmployeeLookTheSame() {
    given(employeeRepository.findByEmployeeNo(no)).willReturn(Optional.of(employee));
    given(employeeRepository.findByEmployeeNo("NONE")).willReturn(Optional.empty());
    String wrong = UUID.randomUUID().toString();

    Throwable wrongPassword = catchThrowable(() -> authService.login(no, wrong));
    Throwable unknown = catchThrowable(() -> authService.login("NONE", wrong));

    assertThat(wrongPassword).isInstanceOf(InvalidCredentialsException.class);
    assertThat(unknown).isInstanceOf(InvalidCredentialsException.class);
    assertThat(unknown.getMessage()).isEqualTo(wrongPassword.getMessage());
    assertThat(unknown.getMessage()).isEqualTo("사번 또는 비밀번호가 올바르지 않습니다.");
    verify(tokenService, never()).issue(any());
  }

  @Test
  @DisplayName("D-42 사번 앞뒤 공백은 지우고 조회한다")
  void loginTrimsEmployeeNo() {
    given(employeeRepository.findByEmployeeNo(no)).willReturn(Optional.of(employee));
    given(tokenService.issue(employee)).willReturn(new IssuedToken("tok", 3600));

    assertThat(authService.login("  " + no + " ", password).user().employeeNo()).isEqualTo(no);
  }

  @Test
  @DisplayName("D-42 me는 사원이 없으면 401 예외다")
  void meWithoutEmployeeIsUnauthorized() {
    given(employeeRepository.findById(99L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> authService.me(99L)).isInstanceOf(UnauthorizedException.class);
  }
}
