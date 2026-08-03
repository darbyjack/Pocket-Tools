export type SerializablePrimitive = string | number | boolean | null;
export type SerializableValue = SerializablePrimitive | readonly SerializableValue[] | {
    readonly [key: string]: SerializableValue;
};
export declare function isSerializableValue(value: unknown, seen?: Set<object>): value is SerializableValue;
