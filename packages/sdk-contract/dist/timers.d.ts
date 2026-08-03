export interface TimerSnapshot {
    readonly id: string;
    readonly startedAt: string;
    readonly elapsedSeconds: number;
}
export interface StoppedTimer {
    readonly id: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly durationSeconds: number;
}
export interface TimerClient {
    start(id: string): TimerSnapshot;
    get(id: string): TimerSnapshot | null;
    stop(id: string): StoppedTimer;
}
