/**
 * Xử lý ảnh phía client trước khi upload (phần "Upload-side privacy" trong bài):
 *   - Đọc kích thước thật → gửi kèm để server lưu width/height → feed giữ chỗ đúng tỉ lệ (tránh CLS).
 *   - Ảnh quá lớn → thu nhỏ bằng canvas (tiết kiệm băng thông).
 *   - Vẽ lại qua canvas đồng thời LOẠI BỎ EXIF (có thể chứa toạ độ GPS!) và áp dụng xoay ảnh.
 * Lưu ý: đây chỉ là tối ưu. Server VẪN phải tự kiểm tra, re-encode, strip metadata – client không đáng tin.
 */
export const MAX_UPLOAD_DIMENSION = 1600;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  wasResized: boolean;
}

// 📖 Bài học lesson-06 §1 – thu nhỏ và bỏ EXIF bằng canvas trước khi upload (docs/lessons/lesson-06.md)
// #region learn:prepare-image-for-upload
export function computeScaledSize(width: number, height: number, maxDimension = MAX_UPLOAD_DIMENSION) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  // createImageBitmap tự áp dụng EXIF orientation (imageOrientation: 'from-image').
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height, scale } = computeScaledSize(bitmap.width, bitmap.height);

  // GIF động sẽ mất animation nếu vẽ lại → giữ nguyên file, và báo kích thước THẬT của file đó.
  if (file.type === 'image/gif') {
    const original = { blob: file, width: bitmap.width, height: bitmap.height, wasResized: false };
    bitmap.close();
    return original;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  // PNG/WebP có thể có nền trong suốt → giữ định dạng; JPEG thì nén lại JPEG.
  const outputType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Không xử lý được ảnh'))), outputType, 0.85),
  );
  return { blob, width, height, wasResized: scale < 1 };
}
// #endregion learn:prepare-image-for-upload
