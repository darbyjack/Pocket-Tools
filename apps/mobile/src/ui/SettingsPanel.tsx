import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type {
  SerializableValue,
  SettingDefinition,
} from "../model";
import { settingIsVisible } from "../runtime/protocol";

interface SettingsPanelProps {
  readonly definitions: Readonly<Record<string, SettingDefinition>>;
  readonly values: Readonly<Record<string, SerializableValue>>;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

export function SettingsPanel({
  definitions,
  values,
  onChange,
}: SettingsPanelProps) {
  const entries = Object.entries(definitions);
  if (entries.length === 0) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Settings</Text>
      {entries.map(([name, definition]) =>
        settingIsVisible(definition, values) ? (
          <SettingControl
            key={name}
            name={name}
            definition={definition}
            value={values[name] ?? definition.default}
            onChange={onChange}
          />
        ) : null,
      )}
    </View>
  );
}

interface SettingControlProps {
  readonly name: string;
  readonly definition: SettingDefinition;
  readonly value: SerializableValue;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function SettingControl({
  name,
  definition,
  value,
  onChange,
}: SettingControlProps) {
  if (definition.type === "select") {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{definition.label}</Text>
        <View style={styles.optionRow}>
          {definition.options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={String(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void onChange(name, option.value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <NumberSetting
      name={name}
      definition={definition}
      value={Number(value)}
      onChange={onChange}
    />
  );
}

interface NumberSettingProps {
  readonly name: string;
  readonly definition: Exclude<SettingDefinition, { readonly type: "select" }>;
  readonly value: number;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function NumberSetting({
  name,
  definition,
  value,
  onChange,
}: NumberSettingProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const minimum = definition.min ?? Number.NEGATIVE_INFINITY;
    const maximum = definition.max ?? Number.POSITIVE_INFINITY;
    const constrained = Math.min(maximum, Math.max(minimum, parsed));
    setDraft(String(constrained));
    void onChange(name, constrained);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{definition.label}</Text>
      <TextInput
        accessibilityLabel={definition.label}
        accessibilityHint="Enter a numeric value"
        inputMode="decimal"
        onBlur={commit}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        selectTextOnFocus
        style={styles.input}
        value={draft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    gap: 14,
    padding: 18,
  },
  title: {
    color: "#172033",
    fontSize: 18,
    fontWeight: "700",
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#f3f5f8",
    borderColor: "#d5dae3",
    borderRadius: 12,
    borderWidth: 1,
    color: "#172033",
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    backgroundColor: "#f3f5f8",
    borderColor: "#d5dae3",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionSelected: {
    backgroundColor: "#172033",
    borderColor: "#172033",
  },
  optionText: {
    color: "#344054",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  optionTextSelected: {
    color: "#ffffff",
  },
});
