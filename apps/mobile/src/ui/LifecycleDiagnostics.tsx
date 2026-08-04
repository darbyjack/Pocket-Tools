import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getPendingTimerRecoveryCheckpoint,
  prepareTimerRecoveryDiagnostic,
  resetLifecycleDiagnostics,
  resumeTimerRecoveryDiagnostic,
  runNamespaceIsolationDiagnostics,
} from "../diagnostics/lifecycle";
import type { DiagnosticCheck, TimerRecoveryCheckpoint } from "../diagnostics/types";
import { ScreenScrollView } from "./ScreenScrollView";
import { Sdk12BadgeAcceptance } from "./Sdk12BadgeAcceptance.tsx";

export interface LifecycleDiagnosticsProps {
  readonly onBack: () => void;
}

export function LifecycleDiagnostics({ onBack }: LifecycleDiagnosticsProps) {
  const [checks, setChecks] = useState<readonly DiagnosticCheck[]>([]);
  const [checkpoint, setCheckpoint] = useState<TimerRecoveryCheckpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pending = await getPendingTimerRecoveryCheckpoint();
        if (!cancelled) setCheckpoint(pending);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runIsolation = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setChecks(await runNamespaceIsolationDiagnostics());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const prepareRecovery = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareTimerRecoveryDiagnostic();
      setCheckpoint(prepared.checkpoint);
      setChecks((current) => [
        ...current.filter((check) => check.id !== prepared.check.id),
        prepared.check,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const resumeRecovery = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await resumeTimerRecoveryDiagnostic();
      setCheckpoint(null);
      setChecks((current) => [
        ...current.filter(
          (check) => check.id !== "timer-recovery-pending" && check.id !== "timer-recovery",
        ),
        result,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await resetLifecycleDiagnostics();
      setCheckpoint(null);
      setChecks([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>Host diagnostics</Text>
          <Text style={styles.title}>Lifecycle and isolation</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What this proves</Text>
        <Text style={styles.infoText}>
          The suite uses temporary installed SDK v1 scripts through the normal QuickJS and SQLite
          paths. It checks colliding names across app namespaces, failure recovery, deletion
          choices, and durable timer reconstruction after a real process stop.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Reading diagnostic state…</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Immediate host suite</Text>
        <Text style={styles.mutedText}>
          Creates two temporary installed scripts with identical setting, collection, and timer
          names, then removes them after the run.
        </Text>
        <ActionButton
          disabled={busy || loading}
          label="Run isolation and recovery suite"
          onPress={runIsolation}
          primary
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Force-stop timer recovery</Text>
        {checkpoint === null ? (
          <>
            <Text style={styles.mutedText}>
              Prepare a temporary installed script and active durable timer. Pocket Tools saves a
              checkpoint for the next launch.
            </Text>
            <ActionButton
              disabled={busy || loading}
              label="Prepare force-stop test"
              onPress={prepareRecovery}
            />
          </>
        ) : (
          <>
            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>Checkpoint ready</Text>
              <Text style={styles.pendingText}>
                Started at {checkpoint.startedAt}. Force-stop Pocket Tools, verify that no process
                remains, wait at least one second, and reopen the app before pressing Resume.
              </Text>
            </View>
            <Text selectable style={styles.command}>
              adb shell am force-stop com.darbyjack.pockettools{"\n"}
              adb shell pidof com.darbyjack.pockettools
            </Text>
            <Text style={styles.mutedText}>
              The second command must print no PID. This manual observation proves the timer did not
              keep React Native or QuickJS alive.
            </Text>
            <ActionButton
              disabled={busy}
              label="Resume after relaunch"
              onPress={resumeRecovery}
              primary
            />
          </>
        )}
      </View>

      <Sdk12BadgeAcceptance />

      {busy ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Running diagnostics…</Text>
        </View>
      ) : null}

      {error === null ? null : (
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorTitle}>Diagnostics could not continue</Text>
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {checks.length === 0 ? null : (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>Results</Text>
          {checks.map((check) => (
            <View key={check.id} style={styles.resultCard}>
              <View style={styles.resultHeading}>
                <Text style={styles.resultTitle}>{check.title}</Text>
                <Text
                  style={[
                    styles.resultStatus,
                    check.status === "passed"
                      ? styles.passed
                      : check.status === "failed"
                        ? styles.failed
                        : styles.pending,
                  ]}
                >
                  {check.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.resultDetail}>{check.detail}</Text>
            </View>
          ))}
        </View>
      )}

      <ActionButton disabled={busy} label="Reset diagnostic state" onPress={reset} />
    </ScreenScrollView>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  primary = false,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        primary ? styles.primaryButton : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.actionButtonText, primary ? styles.primaryButtonText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 48,
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  headingCopy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#101828",
    fontSize: 24,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "#eff8ff",
    borderColor: "#b2ddff",
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  infoTitle: {
    color: "#175cd3",
    fontSize: 15,
    fontWeight: "800",
  },
  infoText: {
    color: "#1849a9",
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e7ec",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionTitle: {
    color: "#101828",
    fontSize: 17,
    fontWeight: "800",
  },
  mutedText: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  primaryButton: {
    backgroundColor: "#172033",
    borderColor: "#172033",
  },
  actionButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: "#ffffff",
  },
  disabled: {
    opacity: 0.45,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  pendingCard: {
    backgroundColor: "#fffaeb",
    borderColor: "#fedf89",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 13,
  },
  pendingTitle: {
    color: "#93370d",
    fontSize: 14,
    fontWeight: "800",
  },
  pendingText: {
    color: "#93370d",
    fontSize: 13,
    lineHeight: 19,
  },
  command: {
    backgroundColor: "#101828",
    borderRadius: 10,
    color: "#f2f4f7",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
  },
  errorCard: {
    backgroundColor: "#fff1f0",
    borderColor: "#fda29b",
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  errorTitle: {
    color: "#912018",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    color: "#b42318",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 18,
  },
  results: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e7ec",
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  resultHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  resultTitle: {
    color: "#101828",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  resultStatus: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  passed: {
    color: "#067647",
  },
  failed: {
    color: "#b42318",
  },
  pending: {
    color: "#b54708",
  },
  resultDetail: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 19,
  },
});
