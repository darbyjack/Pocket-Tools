import { requireNativeModule } from "expo-modules-core";

import { resolveQuickJsSandboxLimits, type QuickJsSandboxLimits } from "./limits.ts";

interface PocketQuickJsNativeModule {
  readonly run: (
    source: string,
    requestJson: string,
    limits: QuickJsSandboxLimits,
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
  return nativeModule.run(source, requestJson, limits);
}
