import { Chip } from '@mui/material';

/** 과정(OPEN 운영 중/CLOSED 종료)과 회차(OPEN 모집 중/CLOSED 마감) 상태 표시 */
export default function StatusChip({
  status,
  kind,
}: {
  status?: 'OPEN' | 'CLOSED';
  kind: 'course' | 'session';
}) {
  if (status === 'CLOSED') {
    return <Chip size="small" label={kind === 'course' ? '종료' : '마감'} />;
  }
  return <Chip size="small" color="success" label={kind === 'course' ? '운영 중' : '모집 중'} />;
}
