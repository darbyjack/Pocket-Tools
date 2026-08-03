import type { SerializablePrimitive, SerializableValue } from "./values.ts";

export interface VisibilityRule {
  readonly setting: string;
  readonly equals: SerializablePrimitive;
}

interface SettingBase<TType extends string, TValue extends SerializableValue> {
  readonly type: TType;
  readonly label: string;
  readonly description?: string;
  readonly default: TValue;
  readonly visibleWhen?: VisibilityRule;
}

export interface TextSetting extends SettingBase<"text", string> {
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface NumberSetting extends SettingBase<"number", number> {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface MoneySetting extends SettingBase<"money", number> {
  readonly currency?: string;
  readonly min?: number;
  readonly max?: number;
}

export interface BooleanSetting extends SettingBase<"boolean", boolean> {}

export interface SelectOption {
  readonly label: string;
  readonly value: SerializablePrimitive;
}

export interface SelectSetting extends SettingBase<"select", SerializablePrimitive> {
  readonly options: readonly SelectOption[];
}

export type SettingDefinition =
  | TextSetting
  | NumberSetting
  | MoneySetting
  | BooleanSetting
  | SelectSetting;

export const setting = {
  text(definition: Omit<TextSetting, "type">): TextSetting {
    return { type: "text", ...definition };
  },
  number(definition: Omit<NumberSetting, "type">): NumberSetting {
    return { type: "number", ...definition };
  },
  money(definition: Omit<MoneySetting, "type">): MoneySetting {
    return { type: "money", ...definition };
  },
  boolean(definition: Omit<BooleanSetting, "type">): BooleanSetting {
    return { type: "boolean", ...definition };
  },
  select(definition: Omit<SelectSetting, "type">): SelectSetting {
    return { type: "select", ...definition };
  },
} as const;

export interface SettingsClient {
  get<TValue extends SerializableValue = SerializableValue>(name: string): TValue;
  set(name: string, value: SerializableValue): void;
}
