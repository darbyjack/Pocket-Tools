export interface PressPropagationEvent {
  stopPropagation(): void;
}

export function invokeIsolatedListAction(
  event: PressPropagationEvent,
  invoke: () => void,
): void {
  event.stopPropagation();
  invoke();
}
