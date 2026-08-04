import type { OutputEffect, RuntimeEffect, RuntimeOperation, RuntimeValue } from "../model.ts";

export function feedbackMessage(effects: readonly RuntimeEffect[] | undefined): string | null {
  if (effects === undefined) return null;
  const feedback = effects.find((effect) => effect.type === "feedback");
  return feedback?.message ?? null;
}

export function outputEffect(effects: readonly RuntimeEffect[] | undefined): OutputEffect | null {
  if (effects === undefined) return null;
  return effects.find((effect): effect is OutputEffect => effect.type !== "feedback") ?? null;
}

export async function completeRuntimeAction(
  value: RuntimeValue,
  applyOperations: (operations: readonly RuntimeOperation[]) => Promise<void>,
  rerender: () => Promise<void>,
  performOutput: (effect: OutputEffect) => Promise<void>,
): Promise<string | null> {
  await applyOperations(value.operations);
  await rerender();
  const output = outputEffect(value.effects);
  if (output !== null) await performOutput(output);
  return feedbackMessage(value.effects);
}
