import type { SerializableValue } from "./values.js";
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
export interface BooleanSetting extends SettingBase<"boolean", boolean> {
}
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
export type SettingDefinition = TextSetting | BooleanSetting | NumberSetting | MoneySetting | SelectSetting;
export declare const setting: {
    readonly text: (definition: Omit<TextSetting, "type">) => TextSetting;
    readonly boolean: (definition: Omit<BooleanSetting, "type">) => BooleanSetting;
    readonly number: (definition: Omit<NumberSetting, "type">) => NumberSetting;
    readonly money: (definition: Omit<MoneySetting, "type">) => MoneySetting;
    readonly select: (definition: Omit<SelectSetting, "type">) => SelectSetting;
};
export interface SettingsClient {
    get<TValue extends SerializableValue = SerializableValue>(name: string): TValue;
}
