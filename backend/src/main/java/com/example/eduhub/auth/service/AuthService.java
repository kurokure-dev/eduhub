package com.example.eduhub.auth.service;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.dto.LoginResponse;
import com.example.eduhub.auth.dto.UserResponse;
import com.example.eduhub.auth.repository.EmployeeRepository;
import com.example.eduhub.common.error.UnauthorizedException;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 로그인과 현재 사용자 조회 (NFR-03, D-42). */
@Service
public class AuthService {

  private final EmployeeRepository employeeRepository;
  private final PasswordEncoder passwordEncoder;
  private final TokenService tokenService;

  /** 없는 사번일 때도 matches를 돌려 응답 시간 차이를 줄이기 위한 더미 해시. */
  private final String dummyHash;

  public AuthService(
      EmployeeRepository employeeRepository,
      PasswordEncoder passwordEncoder,
      TokenService tokenService) {
    this.employeeRepository = employeeRepository;
    this.passwordEncoder = passwordEncoder;
    this.tokenService = tokenService;
    this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
  }

  /**
   * 로그인. 트랜잭션을 걸지 않는다. bcrypt 검증 동안 DB 커넥션을 쥐면 공개 로그인 요청만으로 풀이 바닥나 신청 API(NFR-01)가 막힐 수 있다(NFR-03).
   */
  public LoginResponse login(String employeeNo, String password) {
    Employee employee = employeeRepository.findByEmployeeNo(employeeNo.trim()).orElse(null);
    if (employee == null) {
      passwordEncoder.matches(password, dummyHash);
      throw new InvalidCredentialsException();
    }
    if (!passwordEncoder.matches(password, employee.getPasswordHash())) {
      throw new InvalidCredentialsException();
    }
    return LoginResponse.of(tokenService.issue(employee), employee);
  }

  @Transactional(readOnly = true)
  public UserResponse me(Long id) {
    return employeeRepository
        .findById(id)
        .map(UserResponse::from)
        .orElseThrow(() -> new UnauthorizedException("유효하지 않은 토큰입니다."));
  }
}
