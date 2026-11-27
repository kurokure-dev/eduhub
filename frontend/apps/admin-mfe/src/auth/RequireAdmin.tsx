import type { ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { UserResponseRoleEnum } from '@eduhub/api-client';
import { useAuth } from './AuthContext';
import LoginPage from './LoginPage';

// NFR-03, D-43, D-50: 라우터가 없으므로 상태만 보고 로딩, 로그인, 권한 없음, 관리자 화면 중 하나를 보여 준다
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, initializing, logout } = useAuth();

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <LoginPage />;
  if (user.role !== UserResponseRoleEnum.Admin) {
    // 토큰은 지우지 않는다. 로그아웃 버튼을 누를 때만 지운다
    return (
      <Box sx={{ display: 'grid', gap: 2, maxWidth: 480, mx: 'auto', mt: 6 }}>
        <Alert severity="error">권한이 없습니다.</Alert>
        <p>관리자 계정으로 다시 로그인해 주세요.</p>
        <Button variant="outlined" onClick={logout}>
          로그아웃
        </Button>
      </Box>
    );
  }
  return <>{children}</>;
}
