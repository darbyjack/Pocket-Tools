import { PREVIEW_STORAGE_PREFIX } from "../storage/namespaces";

export type InstallWorkflowMode = "create" | "duplicate" | "edit";

export function assertCandidateIdentity(
  mode: InstallWorkflowMode,
  installedId: string | null,
  candidateId: string,
): void {
  if (mode === "edit" && installedId !== null && installedId !== candidateId) {
    throw new Error(
      `INSTALLATION_FAILED: An update cannot change manifest.id from ${installedId} to ${candidateId}. Use Duplicate to create a new app.`,
    );
  }
  if (mode === "duplicate" && installedId !== null && installedId === candidateId) {
    throw new Error(
      `INSTALLATION_FAILED: A duplicate must change manifest.id from ${installedId} before it can be installed.`,
    );
  }
}

export function isCurrentSourceApproved(
  currentSource: string,
  inspectedSource: string | null,
  previewedSource: string | null,
): boolean {
  return inspectedSource === currentSource && previewedSource === currentSource;
}

export function createPreviewStorageId(
  timestamp = Date.now(),
  random = Math.random(),
): string {
  const randomPart = Math.floor(random * 0x1_0000_0000)
    .toString(36)
    .padStart(7, "0");
  return `${PREVIEW_STORAGE_PREFIX}${timestamp.toString(36)}${randomPart}`;
}
