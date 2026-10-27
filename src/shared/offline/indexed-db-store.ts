/**
 * IndexedDB wrapper tối giản, dựa trên Promise (get / put / delete / getAll).
 *
 * Vì sao IndexedDB mà không phải localStorage cho outbox?
 *   - Bất đồng bộ, không chặn main thread; lưu được object (structured clone), dung lượng lớn hơn nhiều.
 *   - Service worker cũng truy cập được (localStorage thì không) → sau này SW có thể tự flush outbox.
 *
 * Interface `KeyValueStore` tách riêng để logic outbox không phụ thuộc IndexedDB:
 * test dùng store in-memory (môi trường node không có IndexedDB).
 */

// 📖 Bài học lesson-12 – interface KeyValueStore và tên IndexedDB tách theo viewer (docs/lessons/lesson-12.md)
// #region learn:key-value-store-and-viewer-db
export interface KeyValueStore<V> {
  get(key: string): Promise<V | undefined>;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<void>;
  /** Mọi giá trị, sắp theo key (thứ tự của IndexedDB). */
  getAll(): Promise<V[]>;
}

const STORE_NAME = 'kv';

/**
 * Tên DB TÁCH THEO VIEWER: hai người dùng dùng chung một trình duyệt không được thấy
 * (hay lỡ gửi) bài chờ đăng của nhau. Đổi tài khoản = DB khác.
 */
export const outboxDatabaseName = (viewerId: string) => `newsfeed-outbox:${viewerId}`;
// #endregion learn:key-value-store-and-viewer-db

/** Biến một IDBRequest thành Promise. */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Lỗi IndexedDB'));
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
      return;
    }
    const openRequest = indexedDB.open(name, 1);
    openRequest.onupgradeneeded = () => openRequest.result.createObjectStore(STORE_NAME);
    openRequest.onsuccess = () => {
      const db = openRequest.result;
      // Tab khác nâng version/xoá DB → đóng kết nối để không chặn họ.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    openRequest.onerror = () => reject(openRequest.error ?? new Error('Không mở được IndexedDB'));
    openRequest.onblocked = () => reject(new Error('IndexedDB bị chặn bởi tab khác'));
  });
}

// 📖 Bài học lesson-12 – mỗi thao tác một transaction, ghi chỉ xong khi transaction commit (docs/lessons/lesson-12.md)
// #region learn:indexed-db-open-store
/** Mở (và tạo nếu chưa có) một store key-value. Mỗi thao tác chạy trong 1 transaction riêng. */
export async function openIndexedDbStore<V>(databaseName: string): Promise<KeyValueStore<V>> {
  const db = await openDatabase(databaseName);

  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const transaction = db.transaction(STORE_NAME, mode);
    const result = promisifyRequest(action(transaction.objectStore(STORE_NAME)));
    // Với ghi: chỉ coi là xong khi transaction commit (dữ liệu đã bền), không chỉ khi request thành công.
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Transaction IndexedDB lỗi'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Transaction IndexedDB bị huỷ'));
      });
    }
    return result;
  };

  return {
    get: (key) => run<V | undefined>('readonly', (store) => store.get(key)),
    put: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key));
    },
    delete: async (key) => {
      await run('readwrite', (store) => store.delete(key));
    },
    getAll: () => run<V[]>('readonly', (store) => store.getAll()),
  };
}
// #endregion learn:indexed-db-open-store
