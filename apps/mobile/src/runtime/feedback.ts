import type { RuntimeEffect, RuntimeOperation, RuntimeValue } from "../model";

export function feedbackMessage(effects: readonly RuntimeEffect[] | undefined): string | null {
  if (effects === undefined) return null;
  const feedback = effects.find((effect) => effect.type === "feedback");
  return feedback?.message ?? null;
}

export async function completeRuntimeAction(
  value: RuntimeValue,
  applyOperations: (operations: readonly RuntimeOperation[]) => Promise<void>,
  rerender: () => Promise<void>,
): Promise<string | null> {
  await applyOperations(value.operations);
  await rerender();
  return feedbackMessage(value.effects);
}
