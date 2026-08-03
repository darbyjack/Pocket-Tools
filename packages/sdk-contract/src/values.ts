export type SerializablePrimitive = string | number | boolean | null;

export type SerializableValue =
  | SerializablePrimitive
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue };

export function isSerializableValue(value: unknown, seen = new Set<object>()): value is SerializableValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  let result: boolean;
  if (Array.isArray(value)) {
    result = value.every((entry) => isSerializableValue(entry, seen));
  } else if (Object.getPrototypeOf(value) !== Object.prototype) {
    result = false;
  } else {
    result = Object.values(value as Record<string, unknown>).every((entry) =>
      isSerializableValue(entry, seen),
    );
  }

  seen.delete(value);
  return result;
}
