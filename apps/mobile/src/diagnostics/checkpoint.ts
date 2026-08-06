import { getDatabase } from "../storage/database-connection";
import type { TimerRecoveryCheckpoint } from "./types";

const CHECKPOINT_KEY = "lifecycle-diagnostic-timer-recovery";

export async function saveTimerRecoveryCheckpoint(
  checkpoint: TimerRecoveryCheckpoint,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO app_metadata (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    CHECKPOINT_KEY,
    JSON.stringify(checkpoint),
  );
}

export async function loadTimerRecoveryCheckpoint(): Promise<TimerRecoveryCheckpoint | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ readonly value: string }>(
    "SELECT value FROM app_metadata WHERE key = ?",
    CHECKPOINT_KEY,
  );
  if (row === null) return null;

  const value = JSON.parse(row.value) as unknown;
  if (!isTimerRecoveryCheckpoint(value)) {
    throw new Error(
      "DIAGNOSTIC_CHECKPOINT_INVALID: The saved timer recovery checkpoint is malformed.",
    );
  }
  return value;
}

export async function clearTimerRecoveryCheckpoint(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM app_metadata WHERE key = ?", CHECKPOINT_KEY);
}

function isTimerRecoveryCheckpoint(value: unknown): value is TimerRecoveryCheckpoint {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.appId === "string" &&
    typeof record.appName === "string" &&
    typeof record.source === "string" &&
    typeof record.startedAt === "string" &&
    typeof record.preparedAt === "string" &&
    typeof record.launchId === "string"
  );
}
