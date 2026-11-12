import type { SessionRequest } from '@eduhub/api-client';
import { TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import FormDialog from './FormDialog';

interface SessionFormDialogProps {
  open: boolean;
  /** 있으면 수정, 없으면 등록 */
  initial?: SessionRequest;
  onSubmit: (request: SessionRequest) => Promise<unknown>;
  onClose: () => void;
}

interface SessionForm {
  startDate: string;
  place: string;
  capacity: string;
}

const EMPTY: SessionForm = { startDate: '', place: '', capacity: '' };

/**
 * 회차 등록·수정 (FR-03). 정원은 1 이상의 정수다.
 * 신청 기능이 생기기 전까지 정원 변경은 값만 바꾼다 (D-33)
 */
export default function SessionFormDialog({
  open,
  initial,
  onSubmit,
  onClose,
}: SessionFormDialogProps) {
  const [form, setForm] = useState<SessionForm>(EMPTY);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial, capacity: String(initial.capacity) } : EMPTY);
    }
    // 열 때만 초기값으로 채운다. initial이 렌더마다 새 객체여도 입력 중인 값을 지우지 않는다
  }, [open]);

  const capacity = Number(form.capacity);
  const capacityError =
    form.capacity !== '' && !(Number.isInteger(capacity) && capacity >= 1)
      ? '1 이상의 정수를 입력하세요'
      : undefined;
  const placeError = form.place.length > 200 ? '200자 이하로 입력하세요' : undefined;
  const canSubmit =
    form.startDate !== '' &&
    form.place.trim() !== '' &&
    form.capacity !== '' &&
    !capacityError &&
    !placeError;

  return (
    <FormDialog
      open={open}
      title={initial ? '회차 수정' : '회차 등록'}
      submitLabel={initial ? '저장' : '등록'}
      canSubmit={canSubmit}
      onSubmit={() =>
        onSubmit({ startDate: form.startDate, place: form.place.trim(), capacity })
      }
      onClose={onClose}
    >
      <TextField
        label="일정"
        type="date"
        required
        value={form.startDate}
        onChange={(event) => setForm({ ...form, startDate: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="장소"
        required
        value={form.place}
        error={!!placeError}
        helperText={placeError}
        onChange={(event) => setForm({ ...form, place: event.target.value })}
      />
      <TextField
        label="정원"
        type="number"
        required
        value={form.capacity}
        error={!!capacityError}
        helperText={capacityError}
        onChange={(event) => setForm({ ...form, capacity: event.target.value })}
        slotProps={{ htmlInput: { min: 1 } }}
      />
    </FormDialog>
  );
}
