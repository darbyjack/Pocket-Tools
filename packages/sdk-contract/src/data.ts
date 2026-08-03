import type { SerializableValue } from "./values.ts";

interface FieldBase<TType extends string> {
  readonly type: TType;
}

export interface NumberField extends FieldBase<"number"> {
  readonly min?: number;
  readonly max?: number;
}

export interface MoneyField extends FieldBase<"money"> {
  readonly min?: number;
  readonly max?: number;
}

export interface DateTimeField extends FieldBase<"datetime"> {}

export type FieldDefinition = NumberField | MoneyField | DateTimeField;

export const field = {
  number(definition: Omit<NumberField, "type"> = {}): NumberField {
    return { type: "number", ...definition };
  },
  money(definition: Omit<MoneyField, "type"> = {}): MoneyField {
    return { type: "money", ...definition };
  },
  datetime(definition: Omit<DateTimeField, "type"> = {}): DateTimeField {
    return { type: "datetime", ...definition };
  },
} as const;

export interface CollectionDefinition {
  readonly fields: Readonly<Record<string, FieldDefinition>>;
}

export function collection(
  fields: Readonly<Record<string, FieldDefinition>>,
): CollectionDefinition {
  return { fields };
}

export interface QueryFilter {
  readonly field: string;
  readonly operator: "gte";
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
}

export interface StoredRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly [key: string]: SerializableValue;
}

export interface CollectionClient {
  insert(record: Readonly<Record<string, SerializableValue>>): StoredRecord;
  query(query?: CollectionQuery): readonly StoredRecord[];
  count(query?: CollectionQuery): number;
  sum(fieldName: string, query?: CollectionQuery): number;
}

export interface DataClient {
  collection(name: string): CollectionClient;
}
