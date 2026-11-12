import { Navigate, Route, Routes } from 'react-router-dom';
import CourseDetailPage from './pages/CourseDetailPage';
import CourseListPage from './pages/CourseListPage';

/** course-mfe 화면 주소 (D-24). 라우터 자체는 진입점(main.tsx)이나 테스트가 감싼다 */
export default function App() {
  return (
    <Routes>
      <Route path="/courses" element={<CourseListPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
}
