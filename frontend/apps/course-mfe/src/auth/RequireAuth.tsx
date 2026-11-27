import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, CircularProgress } from '@mui/material';
import { UserResponseRoleEnum } from '@eduhub/api-client';
import { useAuth } from './AuthContext';

// NFR-03, D-43: 로그인(admin이면 ADMIN 역할)이 필요한 화면을 감싼다
export default function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (admin && user.role !== UserResponseRoleEnum.Admin) {
    // 로그아웃하지 않고 안내만 보여 준다
    return <Alert severity="error">권한이 없습니다.</Alert>;
  }
  return <>{children}</>;
}
