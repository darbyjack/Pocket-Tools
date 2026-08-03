export const PERMISSION_NAMES = [
  "file-export",
  "file-import",
  "notifications",
  "secure-values",
  "background-work",
  "location",
  "device-information",
  "network",
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

export interface BasicPermissionDeclaration {
  readonly capability: Exclude<PermissionName, "network">;
  readonly reason: string;
}

export interface NetworkPermissionDeclaration {
  readonly capability: "network";
  readonly reason: string;
  readonly allowedHosts: readonly string[];
}

export type PermissionDeclaration =
  | BasicPermissionDeclaration
  | NetworkPermissionDeclaration;

export const SDK_V1_PERMISSION_NAMES = ["file-export", "file-import", "notifications"] as const;
