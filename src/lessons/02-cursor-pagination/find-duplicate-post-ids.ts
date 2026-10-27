// 📖 Bài học lesson-02 §1 – đếm bài trùng để thấy lỗi của offset (docs/lessons/lesson-02.md)
// #region learn:find-duplicate-post-ids
/** Trả về các id xuất hiện nhiều hơn 1 lần trong danh sách (giữ thứ tự xuất hiện lần đầu). */
export function findDuplicatePostIds(postIds: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of postIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return duplicates;
}
// #endregion learn:find-duplicate-post-ids
