/** Lấy thông điệp hiển thị được từ một giá trị bị throw (Error hoặc bất kỳ thứ gì). */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
