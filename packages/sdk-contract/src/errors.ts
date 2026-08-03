export const ERROR_CODES = [
  "INVALID_SCRIPT",
  "INVALID_MANIFEST",
  "UNSUPPORTED_SDK_VERSION",
  "PERMISSION_NOT_DECLARED",
  "PERMISSION_DENIED",
  "RUNTIME_LIMIT_EXCEEDED",
  "INVALID_BRIDGE_VALUE",
  "INVALID_UI_TREE",
  "UNKNOWN_SCREEN",
  "UNKNOWN_ACTION",
  "UNKNOWN_COLLECTION",
  "VALIDATION_FAILED",
  "MIGRATION_FAILED",
  "STORAGE_QUOTA_EXCEEDED",
  "TIMER_NOT_FOUND",
  "INSTALLATION_FAILED",
] as const;

export type PocketToolsErrorCode = (typeof ERROR_CODES)[number];

export interface PocketToolsErrorShape {
  readonly code: PocketToolsErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly line?: number;
  readonly column?: number;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export class PocketToolsError extends Error {
  readonly code: PocketToolsErrorCode;
  readonly path: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly details: Readonly<Record<string, string | number | boolean | null>> | undefined;

  constructor(shape: PocketToolsErrorShape) {
    super(shape.message);
    this.name = "PocketToolsError";
    this.code = shape.code;
    this.path = shape.path;
    this.line = shape.line;
    this.column = shape.column;
    this.details = shape.details;
  }

  toJSON(): PocketToolsErrorShape {
    return {
      code: this.code,
      message: this.message,
      ...(this.path === undefined ? {} : { path: this.path }),
      ...(this.line === undefined ? {} : { line: this.line }),
      ...(this.column === undefined ? {} : { column: this.column }),
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}
