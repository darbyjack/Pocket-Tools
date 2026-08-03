import { requireNativeModule } from "expo-modules-core";

import { resolveQuickJsSandboxLimits, type QuickJsSandboxLimits } from "./limits.ts";

interface PocketQuickJsNativeModule {
  readonly run: (
    source: string,
    requestJson: string,
    maximumSourceBytes: number,
    maximumRequestBytes: number,
    maximumResultBytes: number,
    runtimeMemoryBytes: number,
    runtimeStackBytes: number,
    executionTimeoutMilliseconds: number,
    maximumLogEntries: number,
    maximumLogBytes: number,
  ) => Promise<string>;
}

const nativeModule = requireNativeModule<PocketQuickJsNativeModule>("PocketQuickJs");

export { DEFAULT_QUICKJS_SANDBOX_LIMITS } from "./limits.ts";
export type { QuickJsSandboxLimits } from "./limits.ts";

export function runInQuickJs(
  source: string,
  requestJson: string,
  limitOverrides: Partial<QuickJsSandboxLimits> = {},
): Promise<string> {
  const limits = resolveQuickJsSandboxLimits(limitOverrides);
  return nativeModule.run(
    source,
    requestJson,
    limits.maximumSourceBytes,
    limits.maximumRequestBytes,
    limits.maximumResultBytes,
    limits.runtimeMemoryBytes,
    limits.runtimeStackBytes,
    limits.executionTimeoutMilliseconds,
    limits.maximumLogEntries,
    limits.maximumLogBytes,
  );
}
