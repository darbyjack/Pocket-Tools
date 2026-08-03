export const PREVIEW_STORAGE_PREFIX = "__preview__";
export const DIAGNOSTIC_APP_ID_PREFIX = "lifecycle-diagnostic-";

export function isPreviewStorageId(storageId: string): boolean {
  return storageId.startsWith(PREVIEW_STORAGE_PREFIX);
}

export function isDiagnosticAppId(appId: string): boolean {
  return appId.startsWith(DIAGNOSTIC_APP_ID_PREFIX);
}
