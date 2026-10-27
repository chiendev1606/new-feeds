import { describe, expect, it } from 'vitest';
import type { ComposerDraftState } from './composer-draft-reducer';
import { canSubmitDraft, composerDraftReducer, INITIAL_COMPOSER_STATE } from './composer-draft-reducer';

const upload = { localId: 'l1', fileName: 'a.png', previewUrl: 'blob:1', width: 10, height: 10, alt: '' };

describe('composerDraftReducer', () => {
  it('idempotency key sinh lần đầu và GIỮ NGUYÊN khi retry', () => {
    let state = composerDraftReducer(INITIAL_COMPOSER_STATE, { type: 'textChanged', text: 'Xin chào' });
    state = composerDraftReducer(state, { type: 'submitStarted', newKey: 'key-1' });
    expect(state.idempotencyKey).toBe('key-1');
    state = composerDraftReducer(state, { type: 'submitFailed', error: 'mất mạng' });
    state = composerDraftReducer(state, { type: 'submitStarted', newKey: 'key-2' });
    expect(state.idempotencyKey).toBe('key-1');
  });

  it('sửa nội dung sau khi lỗi → bỏ key cũ', () => {
    let state = composerDraftReducer(INITIAL_COMPOSER_STATE, { type: 'textChanged', text: 'A' });
    state = composerDraftReducer(state, { type: 'submitStarted', newKey: 'key-1' });
    state = composerDraftReducer(state, { type: 'submitFailed', error: 'x' });
    state = composerDraftReducer(state, { type: 'textChanged', text: 'AB' });
    expect(state.idempotencyKey).toBeNull();
  });

  it('thành công → reset draft', () => {
    let state = composerDraftReducer(INITIAL_COMPOSER_STATE, { type: 'textChanged', text: 'A' });
    state = composerDraftReducer(state, { type: 'submitStarted', newKey: 'k' });
    expect(composerDraftReducer(state, { type: 'submitSucceeded' })).toEqual(INITIAL_COMPOSER_STATE);
  });

  it('đang gửi thì không sửa được nội dung → key giữ nguyên, không thể tạo bài trùng', () => {
    let state = composerDraftReducer(INITIAL_COMPOSER_STATE, { type: 'textChanged', text: 'A' });
    state = composerDraftReducer(state, { type: 'submitStarted', newKey: 'key-1' });
    const afterEdit = composerDraftReducer(state, { type: 'textChanged', text: 'AB' });
    expect(afterEdit).toBe(state);
    expect(canSubmitDraft(afterEdit)).toBe(false);
  });

  it('upload: uploading → done', () => {
    let state = composerDraftReducer(INITIAL_COMPOSER_STATE, { type: 'uploadStarted', upload });
    expect(state.uploads[0]?.status).toBe('uploading');
    state = composerDraftReducer(state, { type: 'uploadSucceeded', localId: 'l1', mediaId: 'm1' });
    expect(state.uploads[0]).toMatchObject({ status: 'done', mediaId: 'm1' });
  });
});

describe('canSubmitDraft', () => {
  const base: ComposerDraftState = { ...INITIAL_COMPOSER_STATE, text: 'hi' };

  it('rỗng → không gửi được', () => {
    expect(canSubmitDraft(INITIAL_COMPOSER_STATE)).toBe(false);
    expect(canSubmitDraft({ ...INITIAL_COMPOSER_STATE, text: '   ' })).toBe(false);
  });

  it('ảnh đang upload → chưa gửi được', () => {
    expect(canSubmitDraft({ ...base, uploads: [{ ...upload, status: 'uploading' }] })).toBe(false);
    expect(canSubmitDraft({ ...base, uploads: [{ ...upload, status: 'done', mediaId: 'm' }] })).toBe(true);
  });

  it('đang gửi → không bấm được lần nữa (chống double submit)', () => {
    expect(canSubmitDraft({ ...base, submitState: 'submitting' })).toBe(false);
  });
});
