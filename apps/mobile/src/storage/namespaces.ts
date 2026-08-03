export const PREVIEW_STORAGE_PREFIX = "__preview__";

export function isPreviewStorageId(storageId: string): boolean {
  return storageId.startsWith(PREVIEW_STORAGE_PREFIX);
}
