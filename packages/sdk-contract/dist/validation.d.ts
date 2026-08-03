import type { MiniAppDefinition } from "./core.js";
export interface ValidationIssue {
    readonly path: string;
    readonly message: string;
}
export declare function validateMiniAppDefinition(definition: MiniAppDefinition): readonly ValidationIssue[];
export declare function assertValidMiniAppDefinition(definition: MiniAppDefinition): void;
