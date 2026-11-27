import { Chip } from '@mui/material';
import { MyEnrollmentResponseStatusEnum } from '@eduhub/api-client';

interface Props {
  status: MyEnrollmentResponseStatusEnum | undefined;
  waitingRank?: number | null;
}

/** 신청 상태 칩 (FR-06, D-09). 대기는 현재 순번을 함께 보여 준다 */
export default function StatusChip({ status, waitingRank }: Props) {
  switch (status) {
    case MyEnrollmentResponseStatusEnum.Confirmed:
      return <Chip size="small" color="primary" label="확정" />;
    case MyEnrollmentResponseStatusEnum.Waiting:
      return <Chip size="small" color="warning" label={waitingRank ? `대기 ${waitingRank}번` : '대기'} />;
    case MyEnrollmentResponseStatusEnum.Cancelled:
      return <Chip size="small" color="default" label="취소" />;
    case MyEnrollmentResponseStatusEnum.Completed:
      return <Chip size="small" color="success" label="수료" />;
    default:
      return null;
  }
}
