import { useState } from 'react';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import RequireAdmin from './auth/RequireAdmin';
import AdminCourseDetailPage from './pages/AdminCourseDetailPage';
import AdminCourseListPage from './pages/AdminCourseListPage';

// NFR-03, D-50: 로그인 시 사용자 이름과 로그아웃을 보여 준다. EMPLOYEE도 같다
function TopBar() {
  const { user, logout } = useAuth();
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          EduHub 관리자
        </Typography>
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography>{user.name}</Typography>
            <Button color="inherit" onClick={logout}>
              로그아웃
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

/**
 * 관리자 화면 (FR-03). 화면이 목록과 상세 둘뿐이라 라우터 없이 상태로 전환한다.
 * shell에 붙이거나 화면이 늘어나면 라우팅을 도입한다
 */
function AdminScreens() {
  const [courseId, setCourseId] = useState<number>();

  return courseId === undefined ? (
    <AdminCourseListPage onSelect={setCourseId} />
  ) : (
    <AdminCourseDetailPage courseId={courseId} onBack={() => setCourseId(undefined)} />
  );
}

// 사용자가 바뀌면(다른 탭 로그인 등) 이전 사용자의 화면 상태를 버리고 목록부터 다시 시작한다
function AdminArea() {
  const { user } = useAuth();
  return <AdminScreens key={user?.id} />;
}

export default function App() {
  return (
    <>
      <TopBar />
      <RequireAdmin>
        <AdminArea />
      </RequireAdmin>
    </>
  );
}
