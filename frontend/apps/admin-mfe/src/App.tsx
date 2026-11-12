import { useState } from 'react';
import AdminCourseDetailPage from './pages/AdminCourseDetailPage';
import AdminCourseListPage from './pages/AdminCourseListPage';

/**
 * 관리자 화면 (FR-03). 화면이 목록과 상세 둘뿐이라 라우터 없이 상태로 전환한다.
 * shell에 붙이거나 화면이 늘어나면 라우팅을 도입한다
 */
export default function App() {
  const [courseId, setCourseId] = useState<number>();

  return courseId === undefined ? (
    <AdminCourseListPage onSelect={setCourseId} />
  ) : (
    <AdminCourseDetailPage courseId={courseId} onBack={() => setCourseId(undefined)} />
  );
}
