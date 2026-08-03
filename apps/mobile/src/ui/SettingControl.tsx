import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import type { SerializableValue, SettingDefinition } from "../model";

interface SettingControlProps {
  readonly name: string;
  readonly definition: SettingDefinition;
  readonly value: SerializableValue;
  readonly label?: string;
  readonly placeholder?: string;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

export function SettingControl({
  name,
  definition,
  value,
  label = definition.label,
  placeholder,
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

  if (definition.type === "text") {
    return (
      <TextSetting
        name={name}
        definition={definition}
        value={typeof value === "string" ? value : definition.default}
        label={label}
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
      onChange={onChange}
    />
  );
}

interface TextSettingProps {
  readonly name: string;
  readonly definition: Extract<SettingDefinition, { readonly type: "text" }>;
  readonly value: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function TextSetting({ name, definition, value, label, placeholder, onChange }: TextSettingProps) {
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

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {definition.description === undefined ? null : (
        <Text style={styles.description}>{definition.description}</Text>
      )}
      <TextInput
        accessibilityLabel={label}
        {...(definition.maxLength === undefined ? {} : { maxLength: definition.maxLength })}
        onBlur={commit}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        {...(placeholder === undefined ? {} : { placeholder })}
        style={styles.input}
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
  readonly onChange: (name: string, value: SerializableValue) => Promise<void>;
}

function NumberSetting({ name, definition, value, label, onChange }: NumberSettingProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

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
      <Text style={styles.label}>{label}</Text>
      {definition.description === undefined ? null : (
        <Text style={styles.description}>{definition.description}</Text>
      )}
      <TextInput
        accessibilityHint="Enter a numeric value"
        accessibilityLabel={label}
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
    color: "#344054",
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    color: "#667085",
    fontSize: 13,
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
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    backgroundColor: "#f3f5f8",
    borderColor: "#d5dae3",
    borderRadius: 12,
    borderWidth: 1,
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
