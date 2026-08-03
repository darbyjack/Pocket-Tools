export declare const ERROR_CODES: readonly ["INVALID_SCRIPT", "INVALID_MANIFEST", "UNSUPPORTED_SDK_VERSION", "RUNTIME_LIMIT_EXCEEDED", "INVALID_BRIDGE_VALUE", "INVALID_UI_TREE", "UNKNOWN_SCREEN", "UNKNOWN_ACTION", "UNKNOWN_COLLECTION", "VALIDATION_FAILED", "TIMER_NOT_FOUND", "INSTALLATION_FAILED"];
export type PocketToolsErrorCode = (typeof ERROR_CODES)[number];
export interface PocketToolsErrorShape {
    readonly code: PocketToolsErrorCode;
    readonly message: string;
    readonly path?: string;
    readonly line?: number;
    readonly column?: number;
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}
export declare class PocketToolsError extends Error {
    readonly code: PocketToolsErrorCode;
    readonly path: string | undefined;
    readonly line: number | undefined;
    readonly column: number | undefined;
    readonly details: Readonly<Record<string, string | number | boolean | null>> | undefined;
    constructor(shape: PocketToolsErrorShape);
    toJSON(): PocketToolsErrorShape;
}
