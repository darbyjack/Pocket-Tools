import type { SerializableValue } from "./values.ts";

export interface TimerSnapshot {
  readonly id: string;
  readonly startedAt: string;
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
  stop(id: string): StoppedTimer;
}
