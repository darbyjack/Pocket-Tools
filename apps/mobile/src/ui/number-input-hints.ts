import type { NumberInputDecimalPlaces } from "../runtime/sdk12-number-input-model.ts";

interface NumberInputBounds {
  readonly min?: number;
  readonly max?: number;
}

interface NumberInputNormalizationOptions extends NumberInputBounds {
  readonly decimalPlaces?: NumberInputDecimalPlaces;
}

interface NumberInputStepOptions extends NumberInputNormalizationOptions {
  readonly step: number;
}

export function formatNumberInputValue(
  value: number,
  decimalPlaces?: NumberInputDecimalPlaces,
): string {
  if (!Number.isFinite(value)) return "";
  const normalized = Object.is(value, -0) ? 0 : value;
  if (decimalPlaces === undefined) return String(normalized);
  return roundToDecimalPlaces(normalized, decimalPlaces).toFixed(decimalPlaces);
}

export function parseNumberInputDraft(
  draft: string,
  options: NumberInputNormalizationOptions = {},
): number | undefined {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return normalizeNumberInputValue(parsed, options);
}

export function stepNumberInputValue(
  value: number,
  direction: -1 | 1,
  options: NumberInputStepOptions,
): number | undefined {
  if (!Number.isFinite(value) || !Number.isFinite(options.step) || options.step <= 0) {
    return undefined;
  }

  const precision = Math.min(
    12,
    Math.max(
      options.decimalPlaces ?? 0,
      decimalPlacesForNumber(value),
      decimalPlacesForNumber(options.step),
    ),
  );
  const factor = 10 ** precision;
  const scaledValue = value * factor;
  const scaledStep = options.step * factor;
  const next =
    Number.isSafeInteger(scaledValue) && Number.isSafeInteger(scaledStep)
      ? (scaledValue + direction * scaledStep) / factor
      : Number((value + direction * options.step).toPrecision(15));

  if (!Number.isFinite(next)) return undefined;
  return normalizeNumberInputValue(next, {
    ...options,
    decimalPlaces: options.decimalPlaces ?? precisionAsHint(precision),
  });
}

export function normalizeNumberInputValue(
  value: number,
  options: NumberInputNormalizationOptions = {},
): number | undefined {
  if (!Number.isFinite(value)) return undefined;

  const rounded =
    options.decimalPlaces === undefined
      ? value
      : roundToDecimalPlaces(value, options.decimalPlaces);
  if (!Number.isFinite(rounded)) return undefined;

  const minimum = options.min ?? Number.NEGATIVE_INFINITY;
  const maximum = options.max ?? Number.POSITIVE_INFINITY;
  const constrained = Math.min(maximum, Math.max(minimum, rounded));
  return Object.is(constrained, -0) ? 0 : constrained;
}

function roundToDecimalPlaces(value: number, decimalPlaces: number): number {
  if (decimalPlaces === 0) return Math.round(value);
  const [coefficientText, exponentText = "0"] = value.toString().split("e");
  const coefficient = coefficientText ?? "0";
  const shifted = Math.round(Number(`${coefficient}e${Number(exponentText) + decimalPlaces}`));
  const [roundedCoefficientText, roundedExponentText = "0"] = shifted.toString().split("e");
  const roundedCoefficient = roundedCoefficientText ?? "0";
  return Number(`${roundedCoefficient}e${Number(roundedExponentText) - decimalPlaces}`);
}

function decimalPlacesForNumber(value: number): number {
  const text = Math.abs(value).toString().toLowerCase();
  const [coefficient, exponentText] = text.split("e");
  const coefficientPlaces = coefficient?.split(".")[1]?.length ?? 0;
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  return Math.max(0, coefficientPlaces - exponent);
}

function precisionAsHint(value: number): NumberInputDecimalPlaces | undefined {
  return value >= 0 && value <= 6 ? (value as NumberInputDecimalPlaces) : undefined;
}
