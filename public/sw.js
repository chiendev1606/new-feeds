/**
 * SERVICE WORKER (lesson 12) – JS thuần, KHÔNG qua bundler (Vite phục vụ nguyên file này từ /public).
 *
 * Vai trò: một proxy nằm giữa trang và mạng → quyết định mỗi request lấy từ cache hay từ mạng.
 * Chỉ lo việc ĐỌC khi offline; việc GHI offline là của outbox (IndexedDB) trong tab.
 *
 * Chiến lược theo loại request:
 *   /media/*          cache-first          Ảnh bất biến theo URL (kích thước nằm trong ?w=) → có là dùng, nhanh nhất.
 *   GET /api/feed     NETWORK-FIRST        Online → lấy mạng, cập nhật cache, trả response mạng NGUYÊN VẸN (không gắn header).
 *                                          Chỉ khi fetch lỗi mạng → trả bản cache kèm header X-From-SW-Cache: 1 để UI nói "dữ liệu cũ".
 *   navigate (HTML)   network-first        Ưu tiên bản mới; mất mạng thì rơi về '/' đã cache (app shell, SPA).
 *   /assets/*         cache-first          Bundle build production có hash trong tên file → bất biến. (Dev không có thư mục này.)
 *   non-GET           network-only         Ghi không bao giờ được trả từ cache – không respondWith, để trình duyệt tự gửi.
 *   module của Vite   BỎ QUA hoàn toàn     /src/, /@vite/, /node_modules/... – cache chúng làm HMR trả code cũ.
 *
 * VÌ SAO feed là network-first chứ không phải stale-while-revalidate (SWR)?
 *   Feed production thường dùng SWR + báo "dữ liệu cũ": trả cache ngay cho nhanh, tải nền rồi cập nhật UI. Nhưng SWR ở TẦNG SW
 *   chỉ trả được MỘT response cho mỗi request – trang không có cơ hội "cập nhật sau" mà vẫn nghĩ nó là bản mới. Hệ quả ở app này:
 *   SW scope '/' nên mọi lesson đều đi qua nó; banner "feed đã cũ" ở lesson 09, poll `direction=newer` ở lesson 04 sẽ nhận lại
 *   đúng bản cache cũ trong khi tưởng là mới. Vì vậy ở đây chọn network-first: online thì mọi lesson luôn thấy dữ liệu mới nhất,
 *   cache chỉ là phao cứu sinh khi mất mạng. (Muốn SWR đúng nghĩa thì phải làm ở tầng ứng dụng, nơi UI biết "đây là bản cũ".)
 *
 * Cache feed TÁCH THEO NGƯỜI DÙNG: feed là dữ liệu cá nhân hoá (viewerReaction, quan hệ theo dõi…) và Cache API KHÔNG tôn trọng
 * `Cache-Control: private, no-store` của server. Tab gửi message {type:'set-viewer', viewerId}; SW dùng viewerId làm một phần
 * TÊN cache. Chưa biết viewer → KHÔNG cache feed (thà không có cache còn hơn lộ feed của người khác). Khi viewer đổi, cache của
 * viewer khác bị xoá. Số entry mỗi viewer bị giới hạn (cache theo cả cursor nên nếu không giới hạn sẽ phình mãi).
 *
 * Cache có version (newsfeed-v2-*): tăng số version trong CACHE_PREFIX khi đổi format cache; activate xoá cache version cũ.
 */
// 📖 Bài học lesson-12 – tên cache có version và danh sách đường dẫn bỏ qua của Vite (docs/lessons/lesson-12.md)
// #region learn:sw-cache-names
const CACHE_PREFIX = 'newsfeed-v2-';
const API_CACHE_PREFIX = `${CACHE_PREFIX}api:`;
const CACHES = {
  media: `${CACHE_PREFIX}media`,
  pages: `${CACHE_PREFIX}pages`,
  assets: `${CACHE_PREFIX}assets`,
  /** Chỉ lưu viewerId hiện tại, để SW sống sót qua việc trình duyệt tắt/bật lại nó (biến trong bộ nhớ sẽ mất). */
  meta: `${CACHE_PREFIX}meta`,
};
const VIEWER_META_URL = '/__sw-meta/viewer';
const MAX_FEED_ENTRIES = 30;
const MAX_VIEWER_ID_LENGTH = 100;
const APP_SHELL_URL = '/';
const FROM_CACHE_HEADER = 'X-From-SW-Cache';
const VITE_DEV_PREFIXES = ['/src/', '/@vite/', '/@fs/', '/@id/', '/@react-refresh', '/node_modules/'];
// #endregion learn:sw-cache-names

// 📖 Bài học lesson-12 – skipWaiting, claim và dọn cache version cũ (docs/lessons/lesson-12.md)
// #region learn:sw-install-activate
// skipWaiting + clients.claim: bản SW mới có hiệu lực ngay, và điều khiển luôn tab đang mở
// (không phải tải lại trang lần nữa mới được "controlled").
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Dọn cache của version cũ (cùng họ 'newsfeed-' nhưng không còn dùng).
      const current = new Set(Object.values(CACHES));
      const names = await caches.keys();
      const isStale = (name) => name.startsWith('newsfeed-') && !current.has(name) && !name.startsWith(API_CACHE_PREFIX);
      await Promise.all(names.filter(isStale).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});
// #endregion learn:sw-install-activate

// 📖 Bài học lesson-12 – cache-first cho ảnh và asset bất biến (docs/lessons/lesson-12.md)
// #region learn:sw-cache-first
/** Chỉ cache response thành công, đầy đủ (không cache 206 partial, 4xx, 5xx). */
const isCacheable = (response) => response.status === 200;

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) await cache.put(request, response.clone());
  return response;
}
// #endregion learn:sw-cache-first

// 📖 Bài học lesson-12 – tạo Response mới gắn header X-From-SW-Cache (docs/lessons/lesson-12.md)
// #region learn:sw-mark-from-cache
/** Tạo Response MỚI (Response từ cache là bất biến) với header đánh dấu nguồn cache. */
function markAsFromCache(cached) {
  const headers = new Headers(cached.headers);
  headers.set(FROM_CACHE_HEADER, '1');
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}
// #endregion learn:sw-mark-from-cache

// 📖 Bài học lesson-12 – cache feed tách theo viewer và giới hạn số entry (docs/lessons/lesson-12.md)
// #region learn:sw-viewer-scoped-cache
let viewerIdInMemory = null;

/** viewerId hiện tại: ưu tiên bộ nhớ, rơi về meta cache (SW có thể vừa được khởi động lại). */
async function getViewerId() {
  if (viewerIdInMemory) return viewerIdInMemory;
  const meta = await caches.open(CACHES.meta);
  const stored = await meta.match(VIEWER_META_URL);
  viewerIdInMemory = stored ? await stored.text() : null;
  return viewerIdInMemory;
}

/** Ghi viewer mới; viewer đổi thì xoá cache feed của những viewer khác (máy dùng chung không được lộ dữ liệu cho nhau). */
async function setViewerId(viewerId) {
  viewerIdInMemory = viewerId;
  const meta = await caches.open(CACHES.meta);
  await meta.put(VIEWER_META_URL, new Response(viewerId));
  const keep = apiCacheNameFor(viewerId);
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(API_CACHE_PREFIX) && name !== keep).map((name) => caches.delete(name)));
}

const apiCacheNameFor = (viewerId) => `${API_CACHE_PREFIX}${encodeURIComponent(viewerId)}`;

/** Ghi response vào cache feed rồi cắt bớt entry cũ nhất cho đủ MAX_FEED_ENTRIES (keys() trả theo thứ tự ghi). */
async function putFeedResponse(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FEED_ENTRIES)).map((key) => cache.delete(key)));
}
// #endregion learn:sw-viewer-scoped-cache

function offlineNoCacheResponse() {
  return new Response(JSON.stringify({ error: { code: 'OFFLINE_NO_CACHE', message: 'Đang offline và chưa có dữ liệu trong cache' } }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 📖 Bài học lesson-12 – feed network-first, chỉ khi mất mạng mới trả cache kèm header (docs/lessons/lesson-12.md)
// #region learn:sw-network-first-feed
async function networkFirstFeed(event) {
  const { request } = event;
  const viewerId = await getViewerId();
  try {
    const response = await fetch(request);
    // Chưa biết viewer → không cache. Cache chạy nền (waitUntil), không làm chậm response trả về trang.
    if (viewerId && isCacheable(response)) {
      const copy = response.clone();
      event.waitUntil(
        caches
          .open(apiCacheNameFor(viewerId))
          .then((cache) => putFeedResponse(cache, request, copy))
          .catch(() => undefined), // hết quota/cache lỗi: bỏ qua, response mạng vẫn đã trả cho trang
      );
    }
    return response; // online: nguyên vẹn, KHÔNG gắn X-From-SW-Cache
  } catch {
    // Chỉ lỗi mạng (fetch ném) mới tới đây; 4xx/5xx của server vẫn là response bình thường ở trên.
    if (viewerId) {
      const cache = await caches.open(apiCacheNameFor(viewerId));
      const cached = await cache.match(request);
      if (cached) return markAsFromCache(cached);
    }
    return offlineNoCacheResponse();
  }
}
// #endregion learn:sw-network-first-feed

// 📖 Bài học lesson-12 – điều hướng ưu tiên mạng, mất mạng rơi về app shell (docs/lessons/lesson-12.md)
// #region learn:sw-network-first-navigation
async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHES.pages);
  try {
    const response = await fetch(request);
    // Chỉ lưu HTML thật: điều hướng tới URL trả JSON (vd /__mock/config qua proxy) mà ghi đè app shell thì offline sẽ hiện JSON.
    const isHtml = (response.headers.get('Content-Type') || '').toLowerCase().includes('text/html');
    if (isCacheable(response) && isHtml) await cache.put(APP_SHELL_URL, response.clone());
    return response;
  } catch (error) {
    const shell = await cache.match(APP_SHELL_URL);
    if (shell) return shell;
    throw error;
  }
}
// #endregion learn:sw-network-first-navigation

// 📖 Bài học lesson-12 – định tuyến chiến lược theo loại request, non-GET không đụng vào (docs/lessons/lesson-12.md)
// #region learn:sw-fetch-router
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Không respondWith = trình duyệt xử lý như bình thường (network-only). Áp cho mọi thứ mình không quản.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (VITE_DEV_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirst(request, CACHES.media));
  } else if (url.pathname === '/api/feed') {
    event.respondWith(networkFirstFeed(event));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, CACHES.assets));
  }
});
// #endregion learn:sw-fetch-router

/**
 * Background Sync (chỉ Chromium, best-effort): trình duyệt đánh thức SW khi có mạng lại, kể cả lúc tab đã đóng.
 * SW KHÔNG tự gửi bài – outbox nằm ở tab và dùng cùng logic/idempotency key; SW chỉ nhắn tab "flush đi".
 * Không có tab nào đang mở → ném lỗi để trình duyệt hẹn đồng bộ lại; lần mở tab sau, tab cũng tự flush khi load.
 * Vì Background Sync không có ở Safari/Firefox, vòng flush trong tab (sự kiện 'online' + lúc load) mới là đường đúng.
 */
// 📖 Bài học lesson-12 – Background Sync chỉ nhắn tab flush outbox (docs/lessons/lesson-12.md)
// #region learn:sw-background-sync
self.addEventListener('sync', (event) => {
  if (event.tag !== 'flush-outbox') return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.length === 0) throw new Error('Không có tab nào để flush outbox');
      windows.forEach((client) => client.postMessage({ type: 'flush-outbox' }));
    })(),
  );
});
// #endregion learn:sw-background-sync

async function clearAllCaches() {
  const names = await caches.keys();
  // Giữ meta (viewerId): xoá nó thì SW "quên" viewer và không cache feed cho tới khi tab nhắn lại.
  const owned = names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHES.meta);
  await Promise.all(owned.map((name) => caches.delete(name)));
  return owned.length;
}

// 📖 Bài học lesson-12 – nhận set-viewer và clear-caches từ tab, kiểm tra dữ liệu (docs/lessons/lesson-12.md)
// #region learn:sw-message-handler
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'set-viewer') {
    // Dữ liệu từ tab: kiểm tra kiểu và độ dài trước khi dùng làm tên cache.
    if (typeof data.viewerId === 'string' && data.viewerId.length > 0 && data.viewerId.length <= MAX_VIEWER_ID_LENGTH) {
      event.waitUntil(setViewerId(data.viewerId).catch(() => undefined));
    }
    return;
  }
  if (data.type !== 'clear-caches') return;
  event.waitUntil(
    clearAllCaches().then((deleted) => {
      // Trả lời qua MessagePort nếu tab gửi kèm (để biết khi nào xong).
      if (event.ports && event.ports[0]) event.ports[0].postMessage({ type: 'caches-cleared', deleted });
    }),
  );
});
// #endregion learn:sw-message-handler
