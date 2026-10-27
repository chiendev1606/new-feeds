/**
 * Composer: soạn bài + upload ảnh.
 *
 * Luồng 2 bước (theo bài):
 *   1. Chọn ảnh → upload NGAY (song song) → nhận mediaId. Người dùng vừa gõ chữ vừa chờ upload.
 *   2. Bấm "Đăng" → POST /api/posts { body, mediaIds } kèm Idempotency-Key.
 *
 * Vì sao <textarea> mà không tự viết contenteditable?
 *   contenteditable cực khó làm đúng (selection, IME tiếng Việt, paste HTML bẩn → XSS, undo...).
 *   Production dùng thư viện editor (Lexical, TipTap, Slate) và giữ "model nội bộ" tách khỏi "wire format"
 *   (ở đây wire format là { text, entities }). Lesson này giữ textarea để tập trung vào luồng upload/submit.
 */
import { useEffect, useId, useReducer, useRef } from 'react';
import { createIdempotencyKey } from '../../shared/api/http-client';
import { uploadMedia } from '../../shared/api/feed-api';
import type { Media } from '../../shared/types/feed-entities';
import type { DraftUpload } from './composer-draft-reducer';
import { canSubmitDraft, composerDraftReducer, INITIAL_COMPOSER_STATE } from './composer-draft-reducer';
import { prepareImageForUpload } from './prepare-image-for-upload';
import { toErrorMessage } from '../../shared/utils/to-error-message';

export const MAX_IMAGES_PER_POST = 4;

export interface ComposerSubmitPayload {
  text: string;
  mediaIds: string[];
  /** mediaId → alt text người dùng nhập. */
  altTexts: Record<string, string>;
  idempotencyKey: string;
}

export interface ComposerProps {
  /** Ném lỗi nếu thất bại → composer giữ draft (và key) để thử lại. */
  onSubmit: (payload: ComposerSubmitPayload) => Promise<void>;
  /** Báo cho store biết media vừa upload (để render bài optimistic có ảnh). */
  onMediaUploaded: (media: Media) => void;
}

export function Composer({ onSubmit, onMediaUploaded }: ComposerProps) {
  const [state, dispatch] = useReducer(composerDraftReducer, INITIAL_COMPOSER_STATE);
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef<DraftUpload[]>(state.uploads);
  uploadsRef.current = state.uploads;
  /** Số file đã chọn nhưng đang xử lý (chưa vào state) – để không vượt quá MAX_IMAGES_PER_POST khi chọn nhanh nhiều lần. */
  const preparingCountRef = useRef(0);
  const isSubmitting = state.submitState === 'submitting';

  // Giải phóng blob URL khi rời trang (tránh rò bộ nhớ).
  useEffect(() => () => uploadsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);

  // 📖 Bài học lesson-06 §1 – upload ảnh ngay khi chọn, song song với việc gõ chữ (docs/lessons/lesson-06.md)
  // #region learn:start-upload-flow
  const startUpload = async (file: File) => {
    const localId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    let started = false;
    preparingCountRef.current += 1;
    try {
      const prepared = await prepareImageForUpload(file);
      dispatch({ type: 'uploadStarted', upload: { localId, fileName: file.name, previewUrl, width: prepared.width, height: prepared.height, alt: '' } });
      started = true;
      preparingCountRef.current -= 1;
      // alt nhập sau trong ô bên dưới ảnh và gửi kèm lúc tạo bài (altTexts).
      const response = await uploadMedia({ file: prepared.blob, width: prepared.width, height: prepared.height, alt: '' });
      onMediaUploaded(response.media);
      dispatch({ type: 'uploadSucceeded', localId, mediaId: response.mediaId });
    } catch (error) {
      // Lỗi ngay ở bước đọc ảnh → chưa có mục nào trong danh sách, thêm vào để hiện lỗi.
      if (!started) preparingCountRef.current -= 1;
      if (!started) dispatch({ type: 'uploadStarted', upload: { localId, fileName: file.name, previewUrl, width: 1, height: 1, alt: '' } });
      dispatch({ type: 'uploadFailed', localId, error: toErrorMessage(error) });
    }
  };
  // #endregion learn:start-upload-flow

  // 📖 Bài học lesson-06 §2 – sinh key lần đầu và dùng lại khi retry (docs/lessons/lesson-06.md)
  // #region learn:submit-with-key
  const submit = async () => {
    if (!canSubmitDraft(state)) return;
    // Key mới chỉ được dùng nếu đây là lần gửi đầu; retry dùng lại key cũ (xem reducer).
    const key = state.idempotencyKey ?? createIdempotencyKey();
    dispatch({ type: 'submitStarted', newKey: key });
    try {
      await onSubmit({
        text: state.text,
        mediaIds: state.uploads.map((item) => item.mediaId!),
        altTexts: Object.fromEntries(state.uploads.filter((item) => item.alt.trim()).map((item) => [item.mediaId!, item.alt.trim()])),
        idempotencyKey: key,
      });
      state.uploads.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      dispatch({ type: 'submitSucceeded' });
    } catch (error) {
      dispatch({ type: 'submitFailed', error: toErrorMessage(error) });
    }
  };
  // #endregion learn:submit-with-key

  const remainingSlots = MAX_IMAGES_PER_POST - state.uploads.length - preparingCountRef.current;

  return (
    <form
      className="composer panel"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={textareaId} className="composer__label">
        Bạn đang nghĩ gì?
      </label>
      <textarea
        id={textareaId}
        value={state.text}
        dir="auto"
        rows={3}
        readOnly={isSubmitting}
        maxLength={5000}
        placeholder="Viết gì đó… (Ctrl/⌘ + Enter để đăng)"
        onChange={(event) => dispatch({ type: 'textChanged', text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
        }}
      />

      {state.uploads.length > 0 && (
        <ul className="composer__uploads">
          {state.uploads.map((item) => (
            <li key={item.localId} className={`composer__upload composer__upload--${item.status}`}>
              <img src={item.previewUrl} alt="" style={{ aspectRatio: `${item.width} / ${item.height}` }} />
              {/* Alt text: mô tả ảnh cho người dùng screen reader – bắt buộc về a11y (lesson 07). */}
              <input
                type="text"
                value={item.alt}
                maxLength={300}
                readOnly={isSubmitting}
                placeholder="Mô tả ảnh (alt)…"
                aria-label={`Mô tả ảnh ${item.fileName}`}
                onChange={(event) => dispatch({ type: 'altChanged', localId: item.localId, alt: event.target.value })}
              />
              <span className="muted">
                {item.status === 'uploading' && 'Đang upload…'}
                {item.status === 'done' && `✓ ${item.mediaId}`}
                {item.status === 'error' && <span className="error-text">Lỗi: {item.error}</span>}
              </span>
              <button
                type="button"
                disabled={isSubmitting}
                aria-label={`Bỏ ảnh ${item.fileName}`}
                onClick={() => {
                  URL.revokeObjectURL(item.previewUrl);
                  dispatch({ type: 'uploadRemoved', localId: item.localId });
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="composer__actions">
        {/* 📖 Bài học lesson-06 §1 – giới hạn số ảnh kể cả khi chọn nhanh nhiều lần (docs/lessons/lesson-06.md) */}
        {/* #region learn:file-input-slot-limit */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(event) => {
            const slots = MAX_IMAGES_PER_POST - uploadsRef.current.length - preparingCountRef.current;
            const files = [...(event.target.files ?? [])].slice(0, Math.max(0, slots));
            files.forEach((file) => void startUpload(file));
            event.target.value = '';
          }}
        />
        {/* #endregion learn:file-input-slot-limit */}
        <button type="button" disabled={remainingSlots <= 0 || isSubmitting} onClick={() => fileInputRef.current?.click()}>
          🖼️ Thêm ảnh ({state.uploads.length}/{MAX_IMAGES_PER_POST})
        </button>
        <button type="submit" className="primary" disabled={!canSubmitDraft(state)}>
          {state.submitState === 'submitting' ? 'Đang đăng…' : state.submitState === 'error' ? 'Thử lại' : 'Đăng'}
        </button>
      </div>

      <p className="muted" aria-live="polite">
        {state.uploads.some((item) => item.status === 'uploading') && 'Chờ ảnh upload xong mới đăng được. '}
        {state.error && <span className="error-text">Đăng thất bại: {state.error}. Bấm "Thử lại" – sẽ dùng LẠI cùng key. </span>}
        {state.idempotencyKey && (
          <>
            Idempotency-Key: <code>{state.idempotencyKey.slice(0, 8)}…</code>
          </>
        )}
      </p>
    </form>
  );
}
