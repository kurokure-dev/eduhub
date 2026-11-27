import { Alert, Box, Button } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { EnrollmentResponseStatusEnum } from '@eduhub/api-client';
import { useAuth } from '../auth/AuthContext';
import { EnrollError, useEnroll } from '../hooks/useEnroll';

interface Props {
  sessionId: number;
  onEnrolled?: () => void;
}

interface Notice {
  severity: 'success' | 'error';
  text: string;
}

const ERROR_TEXT = {
  conflict: '이미 신청한 회차입니다',
  notFound: '회차를 찾을 수 없습니다',
  error: '신청 중 오류가 발생했습니다',
} as const;

/** 회차 신청 버튼 (FR-06, D-28). 비로그인이면 로그인 링크, 결과는 버튼 아래 Alert로 보여 준다 */
export default function EnrollButton({ sessionId, onEnrolled }: Props) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  const { enroll, pending } = useEnroll();
  const [notice, setNotice] = useState<Notice>();
  const [done, setDone] = useState(false);

  // 로그인 확인 중에는 로그인 링크를 띄우지 않는다 (NFR-03)
  if (initializing) {
    return (
      <Button size="small" variant="outlined" disabled>
        신청
      </Button>
    );
  }

  if (!user) {
    return (
      <Button
        size="small"
        variant="outlined"
        component={RouterLink}
        to="/login"
        // 로그인 뒤 상세 화면으로 돌아오게 현재 위치를 넘긴다 (NFR-03)
        state={{ from: location }}
      >
        로그인 후 신청
      </Button>
    );
  }

  const handleClick = async () => {
    setNotice(undefined);
    try {
      const result = await enroll(sessionId);
      setNotice({
        severity: 'success',
        text:
          result.status === EnrollmentResponseStatusEnum.Waiting
            ? result.waitingRank
              ? `대기 ${result.waitingRank}번으로 등록되었습니다`
              : '대기로 등록되었습니다'
            : '신청이 확정되었습니다',
      });
      setDone(true);
      onEnrolled?.();
    } catch (e: unknown) {
      setNotice({ severity: 'error', text: ERROR_TEXT[e instanceof EnrollError ? e.kind : 'error'] });
    }
  };

  return (
    <Box>
      <Button size="small" variant="outlined" disabled={pending || done} onClick={handleClick}>
        신청
      </Button>
      {notice && (
        <Alert severity={notice.severity} sx={{ mt: 1, py: 0 }}>
          {notice.text}
        </Alert>
      )}
    </Box>
  );
}
