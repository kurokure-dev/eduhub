import type { AdminCourseDetailResponse, CourseDetailResponse } from '@eduhub/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminCourseApi } from '../api/adminCourseApi';
import { courseApi } from '../api/courseApi';
import { httpStatusOf } from './httpStatus';

/** 공개·관리자 응답을 하나로 맞춘 회차 (FR-06, D-54) */
export interface SessionView {
  id: number;
  startDate: string;
  place: string;
  capacity: number;
  remainingSeats: number;
  closed: boolean;
}

/** 공개·관리자 응답을 하나로 맞춘 과정 상세 (FR-06, D-54) */
export interface CourseDetailView {
  id: number;
  title: string;
  category: string;
  description: string;
  closed: boolean;
  sessions: SessionView[];
}

/** 라우트 파라미터를 과정 id로 바꾼다. 양의 정수가 아니면 undefined (D-24) */
function parseCourseId(id: string | undefined): number | undefined {
  if (!id || !/^\d+$/.test(id)) return undefined;
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** 공개 API 응답: 모집 중인 것만 오므로 closed=false */
function fromPublic(d: CourseDetailResponse): CourseDetailView {
  return {
    id: d.id ?? 0,
    title: d.title ?? '',
    category: d.category ?? '',
    description: d.description ?? '',
    closed: false,
    sessions: (d.sessions ?? []).map((s) => ({
      id: s.id ?? 0,
      startDate: s.startDate ?? '',
      place: s.place ?? '',
      capacity: s.capacity ?? 0,
      remainingSeats: s.remainingSeats ?? 0,
      closed: false,
    })),
  };
}

/** 관리자 API 응답: status로 종료를 알리고, 남은 자리는 정원 - 확정 인원 */
function fromAdmin(d: AdminCourseDetailResponse): CourseDetailView {
  return {
    id: d.id ?? 0,
    title: d.title ?? '',
    category: d.category ?? '',
    description: d.description ?? '',
    closed: d.status === 'CLOSED',
    sessions: (d.sessions ?? []).map((s) => ({
      id: s.id ?? 0,
      startDate: s.startDate ?? '',
      place: s.place ?? '',
      capacity: s.capacity ?? 0,
      remainingSeats: (s.capacity ?? 0) - (s.confirmedCount ?? 0),
      closed: s.status === 'CLOSED',
    })),
  };
}

/**
 * 과정 상세와 회차 조회 (FR-02, FR-06).
 * admin이면 종료된 과정·회차도 보이는 관리자 API(D-54)를, 아니면 공개 API를 부른다.
 * 없거나 잘못된 id는 error가 아니라 notFound로 알린다 (D-24, D-28).
 * refresh()는 로딩 표시 없이 다시 조회해 데이터만 바꾼다 (신청 뒤 남은 자리 갱신)
 */
export function useCourseDetail(id: string | undefined, options?: { admin?: boolean; enabled?: boolean }) {
  const admin = options?.admin ?? false;
  // enabled=false면 조회를 보류하고 로딩으로 둔다 (로그인 확인 중 관리자 여부가 정해지기 전, D-54)
  const enabled = options?.enabled ?? true;
  const courseId = parseCourseId(id);
  const [data, setData] = useState<CourseDetailView>();
  const [loading, setLoading] = useState(courseId !== undefined);
  const [notFound, setNotFound] = useState(courseId === undefined);
  const [error, setError] = useState<Error>();
  // 오래된 응답이 id·모드가 바뀐 뒤의 데이터를 덮어쓰지 않게 세대로 구분한다
  const generation = useRef(0);
  // refresh를 연달아 부르면 마지막 요청의 응답만 반영한다
  const refreshSeq = useRef(0);

  const fetchDetail = useCallback(
    async (cid: number): Promise<CourseDetailView> =>
      admin
        ? fromAdmin((await adminCourseApi.getAdminCourse({ id: cid })).data)
        : fromPublic((await courseApi.getDetail({ id: cid })).data),
    [admin],
  );

  useEffect(() => {
    const current = ++generation.current;
    if (!enabled) {
      setData(undefined);
      setError(undefined);
      setLoading(true);
      return;
    }
    setData(undefined);
    setError(undefined);
    if (courseId === undefined) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setNotFound(false);
    setLoading(true);
    fetchDetail(courseId)
      .then((view) => {
        if (generation.current === current) setData(view);
      })
      .catch((e: unknown) => {
        if (generation.current !== current) return;
        if (httpStatusOf(e) === 404) setNotFound(true);
        else setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    return () => {
      // 이 효과가 요청한 응답을 무시한다
      generation.current++;
    };
  }, [courseId, fetchDetail, enabled]);

  const refresh = useCallback(async () => {
    if (courseId === undefined) return;
    const current = generation.current;
    const seq = ++refreshSeq.current;
    try {
      const view = await fetchDetail(courseId);
      if (generation.current === current && refreshSeq.current === seq) setData(view);
    } catch {
      // 갱신 실패는 화면의 기존 데이터를 그대로 둔다
    }
  }, [courseId, fetchDetail]);

  return { data, loading, notFound, error, refresh };
}
