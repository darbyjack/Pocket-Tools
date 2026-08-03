export interface QuickJsSandboxLimits {
  readonly maximumSourceBytes: number;
  readonly maximumRequestBytes: number;
  readonly maximumResultBytes: number;
  readonly runtimeMemoryBytes: number;
  readonly runtimeStackBytes: number;
  readonly executionTimeoutMilliseconds: number;
  readonly maximumLogEntries: number;
  readonly maximumLogBytes: number;
}

export const DEFAULT_QUICKJS_SANDBOX_LIMITS: QuickJsSandboxLimits = Object.freeze({
  maximumSourceBytes: 512 * 1024,
  maximumRequestBytes: 2 * 1024 * 1024,
  maximumResultBytes: 2 * 1024 * 1024,
  runtimeMemoryBytes: 32 * 1024 * 1024,
  runtimeStackBytes: 512 * 1024,
  executionTimeoutMilliseconds: 250,
  maximumLogEntries: 100,
  maximumLogBytes: 64 * 1024,
});

const ABSOLUTE_LIMITS: Readonly<
  Record<keyof QuickJsSandboxLimits, readonly [minimum: number, maximum: number]>
> = Object.freeze({
  maximumSourceBytes: [1, 8 * 1024 * 1024],
  maximumRequestBytes: [1, 32 * 1024 * 1024],
  maximumResultBytes: [256, 16 * 1024 * 1024],
  runtimeMemoryBytes: [4 * 1024 * 1024, 512 * 1024 * 1024],
  runtimeStackBytes: [64 * 1024, 8 * 1024 * 1024],
  executionTimeoutMilliseconds: [10, 30_000],
  maximumLogEntries: [0, 1_000],
  maximumLogBytes: [0, 1024 * 1024],
});

export function resolveQuickJsSandboxLimits(
  overrides: Partial<QuickJsSandboxLimits> = {},
): QuickJsSandboxLimits {
  const limits = { ...DEFAULT_QUICKJS_SANDBOX_LIMITS, ...overrides };

  for (const key of Object.keys(ABSOLUTE_LIMITS) as (keyof QuickJsSandboxLimits)[]) {
    const value = limits[key];
    const [minimum, maximum] = ABSOLUTE_LIMITS[key];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(`${key} must be an integer from ${minimum} to ${maximum}.`);
    }
  }

  return Object.freeze(limits);
}
