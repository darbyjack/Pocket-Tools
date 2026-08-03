import type { SerializableValue } from "./values.ts";

interface FieldBase<TType extends string> {
  readonly type: TType;
  readonly optional?: boolean;
  readonly default?: SerializableValue;
}

export interface TextField extends FieldBase<"text"> {
  readonly maxLength?: number;
}

export interface NumberField extends FieldBase<"number"> {
  readonly min?: number;
  readonly max?: number;
}

export interface MoneyField extends FieldBase<"money"> {
  readonly currency?: string;
  readonly min?: number;
  readonly max?: number;
}

export interface BooleanField extends FieldBase<"boolean"> {}
export interface DateTimeField extends FieldBase<"datetime"> {}
export interface JsonField extends FieldBase<"json"> {}

export type FieldDefinition =
  | TextField
  | NumberField
  | MoneyField
  | BooleanField
  | DateTimeField
  | JsonField;

export const field = {
  text(definition: Omit<TextField, "type"> = {}): TextField {
    return { type: "text", ...definition };
  },
  number(definition: Omit<NumberField, "type"> = {}): NumberField {
    return { type: "number", ...definition };
  },
  money(definition: Omit<MoneyField, "type"> = {}): MoneyField {
    return { type: "money", ...definition };
  },
  boolean(definition: Omit<BooleanField, "type"> = {}): BooleanField {
    return { type: "boolean", ...definition };
  },
  datetime(definition: Omit<DateTimeField, "type"> = {}): DateTimeField {
    return { type: "datetime", ...definition };
  },
  json(definition: Omit<JsonField, "type"> = {}): JsonField {
    return { type: "json", ...definition };
  },
} as const;

export interface CollectionIndex {
  readonly fields: readonly string[];
  readonly unique?: boolean;
}

export interface CollectionDefinition {
  readonly fields: Readonly<Record<string, FieldDefinition>>;
  readonly indexes?: readonly CollectionIndex[];
}

export function collection(
  fields: Readonly<Record<string, FieldDefinition>>,
  options: Omit<CollectionDefinition, "fields"> = {},
): CollectionDefinition {
  return { fields, ...options };
}

export type QueryOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";

export interface QueryFilter {
  readonly field: string;
  readonly operator: QueryOperator;
  readonly value: SerializableValue;
}

export interface QueryOrder {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

export interface CollectionQuery {
  readonly where?: readonly QueryFilter[];
  readonly orderBy?: readonly QueryOrder[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface StoredRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly [key: string]: SerializableValue;
}

export interface CollectionClient {
  insert(record: Readonly<Record<string, SerializableValue>>): StoredRecord;
  get(id: string): StoredRecord | null;
  update(id: string, changes: Readonly<Record<string, SerializableValue>>): StoredRecord;
  remove(id: string): void;
  query(query?: CollectionQuery): readonly StoredRecord[];
  count(query?: CollectionQuery): number;
  sum(fieldName: string, query?: CollectionQuery): number;
  average(fieldName: string, query?: CollectionQuery): number | null;
  minimum(fieldName: string, query?: CollectionQuery): number | null;
  maximum(fieldName: string, query?: CollectionQuery): number | null;
}

export interface DataClient {
  collection(name: string): CollectionClient;
  transaction<TResult extends SerializableValue>(callback: () => TResult): TResult;
}
