import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import type {
  MultiSelectSetting as MultiSelectSettingDefinition,
  SerializableValue,
  SettingDefinition,
} from "../model";
import {
  dateStringToLocalDate,
  dateTimeStringToDate,
  localDateToDateString,
} from "../runtime/date-values.ts";
import type { NumberInputDecimalPlaces } from "../runtime/sdk12-number-input-model.ts";
import { normalizeMultiSelectValue, selectValueKey } from "../runtime/sdk12-multiselect.ts";
import {
  DEFAULT_MULTILINE_LINES,
  multilineInputHeight,
  type MultilineLineCount,
} from "./multiline-input-layout.ts";
import {
  formatNumberInputValue,
  parseNumberInputDraft,
  stepNumberInputValue,
} from "./number-input-hints.ts";
import { colors, radii } from "./theme.ts";

interface SettingControlProps {
  readonly name: string;
  readonly definition: SettingDefinition;
  readonly value: SerializableValue;
  readonly label?: string;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly minLines?: MultilineLineCount;
  readonly step?: number;
  readonly decimalPlaces?: NumberInputDecimalPlaces;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

export function SettingControl({
  name,
  definition,
  value,
  label = definition.label,
  placeholder,
  multiline = false,
  minLines,
  step,
  decimalPlaces,
  onChange,
}: SettingControlProps) {
  if (definition.type === "boolean") {
    return (
      <View style={styles.toggleRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          {definition.description === undefined ? null : (
            <Text style={styles.description}>{definition.description}</Text>
          )}
        </View>
        <Switch
          accessibilityLabel={label}
          value={value === true}
          onValueChange={(nextValue) => void onChange(name, nextValue)}
        />
      </View>
    );
  }

  if (definition.type === "select") {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {definition.description === undefined ? null : (
          <Text style={styles.description}>{definition.description}</Text>
        )}
        <View style={styles.optionRow}>
          {definition.options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={`${typeof option.value}:${String(option.value)}`}
                accessibilityLabel={`${label}: ${option.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void onChange(name, option.value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (definition.type === "multi-select") {
    return (
      <MultiSelectSetting
        name={name}
        definition={definition}
        value={value}
        label={label}
        onChange={onChange}
      />
    );
  }

  if (definition.type === "date" || definition.type === "datetime") {
    return (
      <TemporalSetting
        name={name}
        definition={definition}
        value={typeof value === "string" ? value : definition.default}
        label={label}
        onChange={onChange}
      />
    );
  }

  if (definition.type === "text") {
    return (
      <TextSetting
        name={name}
        definition={definition}
        value={typeof value === "string" ? value : definition.default}
        label={label}
        multiline={multiline}
        {...(minLines === undefined ? {} : { minLines })}
        {...(placeholder === undefined ? {} : { placeholder })}
        onChange={onChange}
      />
    );
  }

  return (
    <NumberSetting
      name={name}
      definition={definition}
      value={typeof value === "number" ? value : definition.default}
      label={label}
      {...(step === undefined ? {} : { step })}
      {...(decimalPlaces === undefined ? {} : { decimalPlaces })}
      onChange={onChange}
    />
  );
}

interface MultiSelectSettingProps {
  readonly name: string;
  readonly definition: MultiSelectSettingDefinition;
  readonly value: SerializableValue;
  readonly label: string;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function MultiSelectSetting({ name, definition, value, label, onChange }: MultiSelectSettingProps) {
  let persistedValues = definition.default;
  try {
    persistedValues = normalizeMultiSelectValue(definition, value, `settings.${name}`);
  } catch {
    persistedValues = definition.default;
  }

  const persistedSignature = JSON.stringify(persistedValues.map(selectValueKey));
  const [draftSignature, setDraftSignature] = useState(persistedSignature);
  useEffect(() => setDraftSignature(persistedSignature), [persistedSignature]);

  const draftKeys = new Set<string>(JSON.parse(draftSignature) as string[]);
  const draftValues = definition.options
    .filter((option) => draftKeys.has(selectValueKey(option.value)))
    .map((option) => option.value);
  const minimum = definition.minSelections ?? 0;
  const maximum = definition.maxSelections ?? definition.options.length;
  const valid = draftValues.length >= minimum && draftValues.length <= maximum;
  const changed = draftSignature !== persistedSignature;
  const selectionHint =
    minimum === maximum
      ? `Select exactly ${minimum} option${minimum === 1 ? "" : "s"}`
      : `Select between ${minimum} and ${maximum} options`;

  const toggle = (key: string, selected: boolean) => {
    const nextKeys = new Set(draftKeys);
    if (selected) nextKeys.delete(key);
    else nextKeys.add(key);
    setDraftSignature(JSON.stringify([...nextKeys]));
  };

  const commit = () => {
    if (!changed || !valid) return;
    void onChange(name, draftValues);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {definition.description === undefined ? null : (
        <Text style={styles.description}>{definition.description}</Text>
      )}
      <Text accessibilityLiveRegion="polite" style={styles.selectionSummary}>
        {draftValues.length} selected. {selectionHint}.
      </Text>
      <View style={styles.optionRow}>
        {definition.options.map((option) => {
          const key = selectValueKey(option.value);
          const selected = draftKeys.has(key);
          const disabled = !selected && draftValues.length >= maximum;
          return (
            <Pressable
              key={key}
              accessibilityHint={selectionHint}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => toggle(key, selected)}
              style={[
                styles.option,
                selected && styles.optionSelected,
                disabled && styles.optionDisabled,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.multiSelectActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed }}
          disabled={!changed}
          onPress={() => setDraftSignature(persistedSignature)}
          style={[styles.secondaryAction, !changed && styles.optionDisabled]}
        >
          <Text style={styles.secondaryActionText}>Discard</Text>
        </Pressable>
        <Pressable
          accessibilityHint={valid ? "Save selected options" : selectionHint}
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed || !valid }}
          disabled={!changed || !valid}
          onPress={commit}
          style={[styles.applyAction, (!changed || !valid) && styles.optionDisabled]}
        >
          <Text style={styles.applyActionText}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface TemporalSettingProps {
  readonly name: string;
  readonly definition: Extract<SettingDefinition, { readonly type: "date" | "datetime" }>;
  readonly value: string;
  readonly label: string;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function TemporalSetting({ name, definition, value, label, onChange }: TemporalSettingProps) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate =
    definition.type === "date" ? dateStringToLocalDate(value) : dateTimeStringToDate(value);
  const minimumDate =
    definition.min === undefined
      ? undefined
      : definition.type === "date"
        ? dateStringToLocalDate(definition.min)
        : dateTimeStringToDate(definition.min);
  const maximumDate =
    definition.max === undefined
      ? undefined
      : definition.type === "date"
        ? dateStringToLocalDate(definition.max)
        : dateTimeStringToDate(definition.max);

  const displayValue =
    definition.type === "date"
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(selectedDate)
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(selectedDate);

  const commit = (nextDate: Date) => {
    setShowPicker(false);
    if (definition.type === "date") {
      void onChange(name, localDateToDateString(nextDate));
      return;
    }

    const normalized = new Date(nextDate);
    normalized.setSeconds(0, 0);
    void onChange(name, normalized.toISOString());
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {definition.description === undefined ? null : (
        <Text style={styles.description}>{definition.description}</Text>
      )}
      <Pressable
        accessibilityHint={definition.type === "date" ? "Choose a date" : "Choose a date and time"}
        accessibilityLabel={`${label}: ${displayValue}`}
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={styles.pickerButton}
      >
        <Text style={styles.pickerValue}>{displayValue}</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          {...(maximumDate === undefined ? {} : { maximumDate })}
          {...(minimumDate === undefined ? {} : { minimumDate })}
          mode={definition.type === "date" ? "date" : "datetime"}
          onDismiss={() => setShowPicker(false)}
          onValueChange={(_event, nextDate) => commit(nextDate)}
          presentation="dialog"
          value={selectedDate}
        />
      ) : null}
    </View>
  );
}

interface TextSettingProps {
  readonly name: string;
  readonly definition: Extract<SettingDefinition, { readonly type: "text" }>;
  readonly value: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly multiline: boolean;
  readonly minLines?: MultilineLineCount;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function TextSetting({
  name,
  definition,
  value,
  label,
  placeholder,
  multiline,
  minLines,
  onChange,
}: TextSettingProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const maximum = definition.maxLength ?? 10_000;
    const constrained = draft.slice(0, maximum);
    if (constrained.length < (definition.minLength ?? 0)) {
      setDraft(value);
      return;
    }
    setDraft(constrained);
    void onChange(name, constrained);
  };

  const visibleLines = minLines ?? DEFAULT_MULTILINE_LINES;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {definition.description === undefined ? null : (
        <Text style={styles.description}>{definition.description}</Text>
      )}
      <TextInput
        {...(multiline ? { accessibilityHint: "Enter multiple lines of text" } : {})}
        accessibilityLabel={label}
        {...(definition.maxLength === undefined ? {} : { maxLength: definition.maxLength })}
        multiline={multiline}
        {...(multiline ? { numberOfLines: visibleLines, scrollEnabled: true } : {})}
        onBlur={commit}
        onChangeText={setDraft}
        {...(multiline ? {} : { onSubmitEditing: commit })}
        {...(placeholder === undefined ? {} : { placeholder })}
        style={[
          styles.input,
          multiline ? styles.multilineInput : null,
          multiline ? { height: multilineInputHeight(visibleLines) } : null,
        ]}
        {...(multiline ? { textAlignVertical: "top" as const } : {})}
        value={draft}
      />
    </View>
  );
}

interface NumberSettingProps {
  readonly name: string;
  readonly definition: Extract<SettingDefinition, { readonly type: "number" | "money" }>;
  readonly value: number;
  readonly label: string;
  readonly step?: number;
  readonly decimalPlaces?: NumberInputDecimalPlaces;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function NumberSetting({
  name,
  definition,
  value,
  label,
  step,
  decimalPlaces,
  onChange,
}: NumberSettingProps) {
  const [draft, setDraft] = useState(formatNumberInputValue(value, decimalPlaces));
  useEffect(() => setDraft(formatNumberInputValue(value, decimalPlaces)), [decimalPlaces, value]);

  const normalizationOptions = {
    ...(definition.min === undefined ? {} : { min: definition.min }),
    ...(definition.max === undefined ? {} : { max: definition.max }),
    ...(decimalPlaces === undefined ? {} : { decimalPlaces }),
  };

  const publish = (nextValue: number) => {
    setDraft(formatNumberInputValue(nextValue, decimalPlaces));
    void onChange(name, nextValue);
  };

  const commit = () => {
    const parsed = parseNumberInputDraft(draft, normalizationOptions);
    if (parsed === undefined) {
      setDraft(formatNumberInputValue(value, decimalPlaces));
      return;
    }
    publish(parsed);
  };

  const adjust = (direction: -1 | 1) => {
    if (step === undefined) return;
    const draftValue = parseNumberInputDraft(draft, normalizationOptions) ?? value;
    const nextValue = stepNumberInputValue(draftValue, direction, {
      ...normalizationOptions,
      step,
    });
    if (nextValue === undefined) {
      setDraft(formatNumberInputValue(value, decimalPlaces));
      return;
    }
    publish(nextValue);
  };

  const stepLabel = step === undefined ? undefined : formatNumberInputValue(step, decimalPlaces);
  const accessibilityHint =
    stepLabel === undefined
      ? "Enter a numeric value"
      : `Enter a numeric value or adjust it by ${stepLabel}`;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {definition.description === undefined ? null : (
        <Text style={styles.description}>{definition.description}</Text>
      )}
      <View style={styles.numberInputRow}>
        {stepLabel === undefined ? null : (
          <Pressable
            accessibilityLabel={`Decrease ${label} by ${stepLabel}`}
            accessibilityRole="button"
            onPress={() => adjust(-1)}
            style={styles.stepButton}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
        )}
        <TextInput
          accessibilityHint={accessibilityHint}
          accessibilityLabel={label}
          inputMode={decimalPlaces === 0 ? "numeric" : "decimal"}
          onBlur={commit}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          selectTextOnFocus
          style={[styles.input, styles.numberInput]}
          value={draft}
        />
        {stepLabel === undefined ? null : (
          <Pressable
            accessibilityLabel={`Increase ${label} by ${stepLabel}`}
            accessibilityRole="button"
            onPress={() => adjust(1)}
            style={styles.stepButton}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
  },
  selectionSummary: {
    color: colors.textMuted,
    fontSize: 12,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multilineInput: {
    lineHeight: 24,
  },
  numberInputRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 8,
  },
  numberInput: {
    flex: 1,
    minWidth: 0,
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 48,
    paddingHorizontal: 12,
  },
  stepButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  pickerButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pickerValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  optionTextSelected: {
    color: colors.surface,
  },
  multiSelectActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  applyAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  applyActionText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
});
