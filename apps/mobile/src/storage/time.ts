export function elapsedSecondsSince(
  startedAt: string,
  nowMilliseconds = Date.now(),
): number {
  const startedAtMilliseconds = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMilliseconds)) return 0;
  return Math.max(0, (nowMilliseconds - startedAtMilliseconds) / 1_000);
}
