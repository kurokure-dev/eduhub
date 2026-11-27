import { AppBar, Button, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { UserResponseRoleEnum } from '@eduhub/api-client';
import { useAuth } from './auth/AuthContext';
import LoginPage from './auth/LoginPage';
import RequireAuth from './auth/RequireAuth';
import CourseDetailPage from './pages/CourseDetailPage';
import MyEnrollmentsPage from './enrollment/MyEnrollmentsPage';
import CourseListPage from './pages/CourseListPage';
import CourseFormPage from './pages/CourseFormPage';
import RosterPage from './enrollment/RosterPage';

// NFR-03: 상단 바. 로그인 상태에 따라 메뉴와 로그인·로그아웃이 달라진다
function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 1 }}>
        <Button color="inherit" component={RouterLink} to="/courses">
          교육과정
        </Button>
        {user && (
          <Button color="inherit" component={RouterLink} to="/my/enrollments">
            내 신청 내역
          </Button>
        )}
        {user?.role === UserResponseRoleEnum.Admin && (
          <Button color="inherit" component={RouterLink} to="/admin/courses/new">
            과정 등록
          </Button>
        )}
        <span style={{ flexGrow: 1 }} />
        {user ? (
          <>
            <Typography>{user.name}</Typography>
            <Button color="inherit" onClick={logout}>
              로그아웃
            </Button>
          </>
        ) : (
          <Button
            color="inherit"
            component={RouterLink}
            to="/login"
            // 로그인 뒤 지금 화면으로 돌아오게 현재 위치를 넘긴다(이미 /login이면 넘기지 않는다)
            state={location.pathname === '/login' ? undefined : { from: location }}
          >
            로그인
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}

/** course-mfe 화면 주소 (D-24). 라우터와 AuthProvider는 진입점(main.tsx)이나 테스트가 감싼다 */
export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/courses" element={<CourseListPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/my/enrollments"
          element={
            <RequireAuth>
              <MyEnrollmentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/courses/new"
          element={
            <RequireAuth admin>
              <CourseFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/courses/:courseId/edit"
          element={
            <RequireAuth admin>
              <CourseFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/sessions/:sessionId/roster"
          element={
            <RequireAuth admin>
              <RosterPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/courses" replace />} />
      </Routes>
    </>
  );
}
