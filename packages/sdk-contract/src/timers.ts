import type { SerializableValue } from "./values.ts";

export type TimerState = "running" | "paused";

export interface TimerSnapshot {
  readonly id: string;
  readonly state: TimerState;
  readonly startedAt: string;
  readonly pausedAt?: string;
  readonly elapsedSeconds: number;
  readonly metadata?: SerializableValue;
}

export interface StoppedTimer {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationSeconds: number;
  readonly metadata?: SerializableValue;
}

export interface TimerClient {
  start(id: string, metadata?: SerializableValue): TimerSnapshot;
  get(id: string): TimerSnapshot | null;
  pause(id: string): TimerSnapshot;
  resume(id: string): TimerSnapshot;
  stop(id: string): StoppedTimer;
  cancel(id: string): void;
}
