import { describe, expect, it } from 'vitest';
import { failureKindOf, problemDetailOf } from './httpStatus';

const httpError = (status: number, data?: unknown) => ({ response: { status, data } });

describe('failureKindOf', () => {
  it('기본은 403을 error로 둔다 (신청·취소 동작 유지)', () => {
    expect(failureKindOf(httpError(403))).toBe('error');
  });

  it.each([
    [409, 'conflict'],
    [404, 'notFound'],
    [403, 'forbidden'],
    [500, 'error'],
  ])('withForbidden: HTTP %i는 %s', (status, kind) => {
    expect(failureKindOf(httpError(status), true)).toBe(kind);
  });

  it('응답이 없는 오류는 error', () => {
    expect(failureKindOf(new Error('network'), true)).toBe('error');
  });
});

describe('problemDetailOf', () => {
  it('detail 문자열을 돌려준다', () => {
    expect(problemDetailOf(httpError(409, { detail: '이미 마감되었습니다' }))).toBe('이미 마감되었습니다');
  });

  it.each([[undefined], [{}], [{ detail: '' }], [{ detail: '  ' }], [{ detail: 3 }], ['text'], [null]])(
    '비었거나 문자열이 아니면 undefined (%j)',
    (data) => {
      expect(problemDetailOf(httpError(400, data))).toBeUndefined();
    },
  );

  it('응답이 없는 오류는 undefined', () => {
    expect(problemDetailOf(new Error('x'))).toBeUndefined();
    expect(problemDetailOf(undefined)).toBeUndefined();
  });
});
