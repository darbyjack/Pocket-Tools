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

export interface NumberSetting extends SettingBase<"number", number> {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface MoneySetting extends SettingBase<"money", number> {
  readonly min?: number;
  readonly max?: number;
}

export interface SelectOption {
  readonly label: string;
  readonly value: SerializablePrimitive;
}

export interface SelectSetting extends SettingBase<"select", SerializablePrimitive> {
  readonly options: readonly SelectOption[];
}

export type SettingDefinition = NumberSetting | MoneySetting | SelectSetting;

export const setting = {
  number(definition: Omit<NumberSetting, "type">): NumberSetting {
    return { type: "number", ...definition };
  },
  money(definition: Omit<MoneySetting, "type">): MoneySetting {
    return { type: "money", ...definition };
  },
  select(definition: Omit<SelectSetting, "type">): SelectSetting {
    return { type: "select", ...definition };
  },
} as const;

export interface SettingsClient {
  get<TValue extends SerializableValue = SerializableValue>(name: string): TValue;
}
