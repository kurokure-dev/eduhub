package com.example.eduhub.common.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 신청 시각(FR-04)을 테스트에서 고정할 수 있도록 Clock을 빈으로 둔다. */
@Configuration
public class ClockConfig {

  @Bean
  public Clock clock() {
    return Clock.systemDefaultZone();
  }
}
