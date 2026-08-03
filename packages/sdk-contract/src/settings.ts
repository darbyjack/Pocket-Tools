import type { SerializableValue } from "./values.ts";

export type SelectValue = string | number | boolean;

export interface VisibilityRule {
  readonly setting: string;
  readonly equals: SelectValue;
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

export interface BooleanSetting extends SettingBase<"boolean", boolean> {}

export interface NumberSetting extends SettingBase<"number", number> {
  readonly min?: number;
  readonly max?: number;
}

export interface MoneySetting extends SettingBase<"money", number> {
  readonly min?: number;
  readonly max?: number;
}

export interface SelectOption {
  readonly label: string;
  readonly value: SelectValue;
}

export interface SelectSetting extends SettingBase<"select", SelectValue> {
  readonly options: readonly SelectOption[];
}

export type SettingDefinition =
  | TextSetting
  | BooleanSetting
  | NumberSetting
  | MoneySetting
  | SelectSetting;

export const setting = {
  text(definition: Omit<TextSetting, "type">): TextSetting {
    return { type: "text", ...definition };
  },
  boolean(definition: Omit<BooleanSetting, "type">): BooleanSetting {
    return { type: "boolean", ...definition };
  },
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
