import type { CourseRequest } from '@eduhub/api-client';
import { TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import FormDialog from './FormDialog';

interface CourseFormDialogProps {
  open: boolean;
  /** 있으면 수정, 없으면 등록 */
  initial?: CourseRequest;
  onSubmit: (request: CourseRequest) => Promise<unknown>;
  onClose: () => void;
}

const EMPTY: CourseRequest = { title: '', category: '', description: '' };

/** 과정 등록·수정 (FR-03). 길이 제한은 백엔드 검증과 같다 (제목 200, 분류 50, 설명 2000) */
export default function CourseFormDialog({ open, initial, onSubmit, onClose }: CourseFormDialogProps) {
  const [form, setForm] = useState<CourseRequest>(initial ?? EMPTY);

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY);
    // 열 때만 초기값으로 채운다. initial이 렌더마다 새 객체여도 입력 중인 값을 지우지 않는다
  }, [open]);

  const titleError = form.title.length > 200 ? '200자 이하로 입력하세요' : undefined;
  const categoryError = form.category.length > 50 ? '50자 이하로 입력하세요' : undefined;
  const descriptionError =
    (form.description ?? '').length > 2000 ? '2000자 이하로 입력하세요' : undefined;
  const canSubmit =
    form.title.trim() !== '' &&
    form.category.trim() !== '' &&
    !titleError &&
    !categoryError &&
    !descriptionError;

  return (
    <FormDialog
      open={open}
      title={initial ? '과정 수정' : '과정 등록'}
      submitLabel={initial ? '저장' : '등록'}
      canSubmit={canSubmit}
      onSubmit={() =>
        onSubmit({
          title: form.title.trim(),
          category: form.category.trim(),
          description: form.description?.trim() || undefined,
        })
      }
      onClose={onClose}
    >
      <TextField
        label="제목"
        required
        value={form.title}
        error={!!titleError}
        helperText={titleError}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
      />
      <TextField
        label="분류"
        required
        value={form.category}
        error={!!categoryError}
        helperText={categoryError}
        onChange={(event) => setForm({ ...form, category: event.target.value })}
      />
      <TextField
        label="설명"
        multiline
        minRows={3}
        value={form.description ?? ''}
        error={!!descriptionError}
        helperText={descriptionError}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
    </FormDialog>
  );
}
