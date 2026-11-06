package com.example.eduhub.common.api;

import java.util.List;
import org.springframework.data.domain.Page;

/** 페이지 응답. page는 0부터 시작한다 (D-18). */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements) {

  public static <T> PageResponse<T> from(Page<T> page) {
    return new PageResponse<>(
        page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements());
  }
}
