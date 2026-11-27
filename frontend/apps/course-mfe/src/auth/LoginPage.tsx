import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { useAuth } from './AuthContext';

// 로그인 뒤 돌아갈 곳: state.from의 pathname + search. 없거나 /login이면 /courses.
// 오픈 리다이렉트를 막기 위해 앱 안의 경로(/로 시작하고 //로 시작하지 않으며 \가 없음)만 받는다
function redirectTarget(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from;
  const pathname = from?.pathname;
  if (typeof pathname !== 'string' || !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.includes('\\')
  ) {
    return '/courses';
  }
  if (pathname === '/login') return '/courses';
  return pathname + (typeof from?.search === 'string' ? from.search : '');
}

export default function LoginPage() {
  const { user, initializing, expired, login } = useAuth();
  const location = useLocation();
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 시작 확인 중에는 이동하지 않고 기다린다(만료 토큰으로 열 때 깜빡임 방지)
  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 이미 로그인했거나 로그인에 성공하면 돌아갈 곳으로 보낸다
  if (user) {
    return <Navigate to={redirectTarget(location.state)} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !employeeNo.trim() || !password) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login(employeeNo.trim(), password);
    } catch (error) {
      setErrorMessage(
        isAxiosError(error) && error.response?.status === 401
          ? '사번 또는 비밀번호가 올바르지 않습니다.'
          : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 360, mx: 'auto', mt: 6, display: 'grid', gap: 2 }}>
      <Typography variant="h5" component="h1">
        로그인
      </Typography>
      {expired && <Alert severity="info">로그인이 만료되었습니다. 다시 로그인해 주세요.</Alert>}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      <TextField label="사번" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} autoFocus />
      <TextField
        label="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" variant="contained" disabled={submitting}>
        로그인
      </Button>
    </Box>
  );
}
