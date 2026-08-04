import type { SerializablePrimitive, SerializableValue } from "./values.js";
export interface FieldBase<TType extends string> {
    readonly type: TType;
    readonly optional?: boolean;
}
export interface TextField extends FieldBase<"text"> {
    readonly minLength?: number;
    readonly maxLength?: number;
}
export interface BooleanField extends FieldBase<"boolean"> {
}
export interface NumberField extends FieldBase<"number"> {
    readonly min?: number;
    readonly max?: number;
}
export interface MoneyField extends FieldBase<"money"> {
    readonly min?: number;
    readonly max?: number;
}
export interface DateField extends FieldBase<"date"> {
    readonly min?: string;
    readonly max?: string;
}
export interface DateTimeField extends FieldBase<"datetime"> {
    readonly min?: string;
    readonly max?: string;
}
export type FieldDefinition = TextField | BooleanField | NumberField | MoneyField | DateField | DateTimeField;
export declare const field: {
    readonly text: (definition?: Omit<TextField, "type">) => TextField;
    readonly boolean: (definition?: Omit<BooleanField, "type">) => BooleanField;
    readonly number: (definition?: Omit<NumberField, "type">) => NumberField;
    readonly money: (definition?: Omit<MoneyField, "type">) => MoneyField;
    readonly date: (definition?: Omit<DateField, "type">) => DateField;
    readonly datetime: (definition?: Omit<DateTimeField, "type">) => DateTimeField;
};
export interface CollectionDefinition {
    readonly fields: Readonly<Record<string, FieldDefinition>>;
}
export declare function collection(fields: Readonly<Record<string, FieldDefinition>>): CollectionDefinition;
export type QueryOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith";
export interface QueryFilter {
    readonly field: string;
    readonly operator: QueryOperator;
    readonly value: SerializablePrimitive;
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
    min(fieldName: string, query?: CollectionQuery): number | null;
    max(fieldName: string, query?: CollectionQuery): number | null;
    average(fieldName: string, query?: CollectionQuery): number | null;
}
export interface DataClient {
    collection(name: string): CollectionClient;
}
