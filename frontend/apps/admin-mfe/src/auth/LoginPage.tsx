import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { useAuth } from './AuthContext';

// NFR-03, D-50: course-mfe LoginPage에서 라우터 처리를 뺀 복사본이다.
// 로딩과 로그인 뒤 화면 전환은 RequireAdmin이 user 상태를 보고 한다
export default function LoginPage() {
  const { expired, login } = useAuth();
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        관리자 로그인
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
