// 📖 Bài học shared-foundations §5 – client re-export hợp đồng từ shared-contracts (docs/lessons/shared-foundations.md)
// #region learn:client-reexport-contract
/**
 * Types phía client: re-export hợp đồng API + các type chỉ client dùng.
 */
export * from '../../../shared-contracts/feed-api-contracts';
// #endregion learn:client-reexport-contract

import type { Media, Post, User } from '../../../shared-contracts/feed-api-contracts';

/** Bộ entity đã chuẩn hoá – hình dạng chung của mọi response có chứa post. */
export interface NormalizedEntities {
  posts: Record<string, Post>;
  users: Record<string, User>;
  media: Record<string, Media>;
}
