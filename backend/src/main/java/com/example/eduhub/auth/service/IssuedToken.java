package com.example.eduhub.auth.service;

/** 발급된 토큰 문자열과 만료까지의 초 (NFR-03). */
public record IssuedToken(String value, long expiresInSeconds) {}
