/**
 * State của composer (ComposerDraft trong phần Data model của bài).
 *
 * Quy tắc idempotency key:
 *   - Sinh ở LẦN BẤM "Đăng" ĐẦU TIÊN (submitStarted), giữ nguyên qua mọi lần retry/bấm lại.
 *   - Nếu người dùng SỬA nội dung (text/ảnh) sau khi gửi lỗi → xoá key, vì đó là một bài viết khác.
 *   - Đăng thành công → reset toàn bộ draft (key mới cho bài sau).
 *   - Trong lúc đang gửi: KHOÁ mọi thao tác sửa nội dung.
 */
export type UploadStatus = 'uploading' | 'done' | 'error';

export interface DraftUpload {
  localId: string;
  fileName: string;
  /** URL.createObjectURL – xem trước ngay, không cần chờ upload. Phải revoke khi bỏ. */
  previewUrl: string;
  width: number;
  height: number;
  alt: string;
  status: UploadStatus;
  mediaId?: string;
  error?: string;
}

export interface ComposerDraftState {
  text: string;
  uploads: DraftUpload[];
  submitState: 'idle' | 'submitting' | 'error';
  idempotencyKey: string | null;
  error: string | null;
}

export const INITIAL_COMPOSER_STATE: ComposerDraftState = { text: '', uploads: [], submitState: 'idle', idempotencyKey: null, error: null };

export type ComposerAction =
  | { type: 'textChanged'; text: string }
  | { type: 'uploadStarted'; upload: Omit<DraftUpload, 'status'> }
  | { type: 'uploadSucceeded'; localId: string; mediaId: string }
  | { type: 'uploadFailed'; localId: string; error: string }
  | { type: 'uploadRemoved'; localId: string }
  | { type: 'altChanged'; localId: string; alt: string }
  /** newKey chỉ được dùng nếu draft chưa có key (lần gửi đầu). */
  | { type: 'submitStarted'; newKey: string }
  | { type: 'submitFailed'; error: string }
  | { type: 'submitSucceeded' };

/** Sửa nội dung → bài viết khác → bỏ key cũ. */
const contentChanged = (state: ComposerDraftState): ComposerDraftState => ({ ...state, idempotencyKey: null, submitState: 'idle', error: null });

/** Các action sửa nội dung – bị chặn trong lúc đang gửi. */
const CONTENT_EDIT_ACTIONS = new Set<ComposerAction['type']>(['textChanged', 'uploadStarted', 'uploadRemoved', 'altChanged']);

export function composerDraftReducer(state: ComposerDraftState, action: ComposerAction): ComposerDraftState {
  // Đang gửi mà cho sửa nội dung thì vừa xoá mất key (→ bấm lại tạo bài TRÙNG), vừa mất chữ vừa gõ khi request đầu thành công.
  if (state.submitState === 'submitting' && CONTENT_EDIT_ACTIONS.has(action.type)) return state;
  switch (action.type) {
    case 'textChanged':
      return { ...contentChanged(state), text: action.text };
    case 'uploadStarted':
      return { ...contentChanged(state), uploads: [...state.uploads, { ...action.upload, status: 'uploading' }] };
    case 'uploadSucceeded':
      return { ...state, uploads: state.uploads.map((item) => (item.localId === action.localId ? { ...item, status: 'done', mediaId: action.mediaId } : item)) };
    case 'uploadFailed':
      return { ...state, uploads: state.uploads.map((item) => (item.localId === action.localId ? { ...item, status: 'error', error: action.error } : item)) };
    case 'uploadRemoved':
      return { ...contentChanged(state), uploads: state.uploads.filter((item) => item.localId !== action.localId) };
    case 'altChanged':
      return { ...contentChanged(state), uploads: state.uploads.map((item) => (item.localId === action.localId ? { ...item, alt: action.alt } : item)) };
    case 'submitStarted':
      return { ...state, submitState: 'submitting', error: null, idempotencyKey: state.idempotencyKey ?? action.newKey };
    case 'submitFailed':
      return { ...state, submitState: 'error', error: action.error };
    case 'submitSucceeded':
      return INITIAL_COMPOSER_STATE;
  }
}

export function canSubmitDraft(state: ComposerDraftState) {
  const allUploadsDone = state.uploads.every((item) => item.status === 'done');
  const hasContent = state.text.trim().length > 0 || state.uploads.length > 0;
  return state.submitState !== 'submitting' && allUploadsDone && hasContent;
}
