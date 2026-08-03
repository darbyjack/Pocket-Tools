import type { MiniAppInspection, RuntimeSnapshot } from "../model";
import { inspectMiniApp, invokeMiniAppAction, renderMiniApp } from "../runtime/quickjs";
import { validatePageNode } from "../runtime/ui-validation";
import {
  applyRuntimeOperations,
  deleteInstalledMiniApp,
  ensureSettingDefaults,
  getInstalledMiniApp,
  installMiniApp,
  loadRuntimeSnapshot,
  setSetting,
} from "../storage/database";
import { elapsedSecondsSince } from "../storage/time";
import {
  clearTimerRecoveryCheckpoint,
  loadTimerRecoveryCheckpoint,
  saveTimerRecoveryCheckpoint,
} from "./checkpoint";
import { createLifecycleDiagnosticSource, DIAGNOSTIC_APP_ID_PREFIX } from "./fixtures";
import type { DiagnosticCheck, TimerRecoveryCheckpoint } from "./types";

const SETTING = "sharedValue";
const COLLECTION = "sharedRecords";
const TIMER = "sharedTimer";
const HOST_LAUNCH_ID = createDiagnosticSuffix();

interface DiagnosticApp {
  readonly id: string;
  readonly source: string;
  readonly inspection: MiniAppInspection;
}

export async function runNamespaceIsolationDiagnostics(): Promise<readonly DiagnosticCheck[]> {
  const suffix = createDiagnosticSuffix();
  const [appA, appB] = await Promise.all([
    createDiagnosticApp(`${DIAGNOSTIC_APP_ID_PREFIX}${suffix}-a`, "Lifecycle Diagnostic A"),
    createDiagnosticApp(`${DIAGNOSTIC_APP_ID_PREFIX}${suffix}-b`, "Lifecycle Diagnostic B"),
  ]);
  const checks: DiagnosticCheck[] = [];

  try {
    await Promise.all([cleanupDiagnosticApp(appA.id), cleanupDiagnosticApp(appB.id)]);
    await installDiagnosticApp(appA);
    await installDiagnosticApp(appB);

    await setSetting(appA.inspection, appA.id, SETTING, "alpha");
    await setSetting(appB.inspection, appB.id, SETTING, "beta");
    await invokeAction(appA, "seed");
    await invokeAction(appB, "seed");

    const [snapshotA, snapshotB] = await Promise.all([
      loadRenderSnapshot(appA),
      loadRenderSnapshot(appB),
    ]);
    assertIsolatedSnapshot(snapshotA, "alpha", 1);
    assertIsolatedSnapshot(snapshotB, "beta", 1);
    checks.push(
      passed(
        "namespace-isolation",
        "Settings, records, and timers are isolated",
        "Two installed scripts used identical setting, collection, and timer names without observing each other’s values.",
      ),
    );

    await renderDiagnosticScreen(appA, "home");
    await renderDiagnosticScreen(appA, "details");
    await renderDiagnosticScreen(appA, "home");
    assertSamePersistedState(snapshotA, await loadRenderSnapshot(appA));
    checks.push(
      passed(
        "navigation-stability",
        "Navigation leaves persisted state unchanged",
        "The installed script rendered home, details, and home again through QuickJS without mutating its setting, record, or timer namespace.",
      ),
    );

    const beforeFailure = await loadRenderSnapshot(appA);
    let failureObserved = false;
    try {
      await invokeAction(appA, "fail");
    } catch {
      failureObserved = true;
    }
    if (!failureObserved) {
      throw new Error("The intentional script failure unexpectedly succeeded.");
    }

    const afterFailure = await loadRenderSnapshot(appA);
    assertSamePersistedState(beforeFailure, afterFailure);
    await invokeAction(appA, "addRecord");
    const afterRecovery = await loadRenderSnapshot(appA);
    assertIsolatedSnapshot(afterRecovery, "alpha", 2);
    checks.push(
      passed(
        "failure-recovery",
        "A failed invocation does not poison later work",
        "The failing action persisted nothing, and a following action completed through a fresh QuickJS runtime.",
      ),
    );

    await deleteInstalledMiniApp(appA.id, false);
    if ((await getInstalledMiniApp(appA.id)) !== null) {
      throw new Error("Remove-with-retained-data left the installation record behind.");
    }
    const retained = await loadRenderSnapshot(appA);
    assertIsolatedSnapshot(retained, "alpha", 2);

    await installMiniApp(appA.inspection, appA.source);
    const restored = await loadRenderSnapshot(appA);
    assertIsolatedSnapshot(restored, "alpha", 2);

    await deleteInstalledMiniApp(appA.id, true);
    const cleared = await loadRenderSnapshot(appA);
    if (
      Object.keys(cleared.settings).length !== 0 ||
      (cleared.records[COLLECTION]?.length ?? 0) !== 0 ||
      Object.keys(cleared.timers).length !== 0
    ) {
      throw new Error("Remove-with-data did not clear the complete app namespace.");
    }
    checks.push(
      passed(
        "deletion-semantics",
        "Removal preserves or deletes state as selected",
        "Retained data survived reinstall with the same manifest ID, while remove-with-data cleared settings, records, and timers.",
      ),
    );
  } catch (caught) {
    checks.push(
      failed("diagnostic-suite", "Lifecycle diagnostic suite failed", errorMessage(caught)),
    );
  } finally {
    await Promise.allSettled([cleanupDiagnosticApp(appA.id), cleanupDiagnosticApp(appB.id)]);
  }

  return checks;
}

export async function prepareTimerRecoveryDiagnostic(): Promise<{
  readonly checkpoint: TimerRecoveryCheckpoint;
  readonly check: DiagnosticCheck;
}> {
  const previous = await loadTimerRecoveryCheckpoint();
  if (previous !== null) {
    await cleanupDiagnosticApp(previous.appId);
    await clearTimerRecoveryCheckpoint();
  }

  const app = await createDiagnosticApp(
    `${DIAGNOSTIC_APP_ID_PREFIX}${createDiagnosticSuffix()}-recovery`,
    "Timer Recovery Diagnostic",
  );
  await installDiagnosticApp(app);
  await setSetting(app.inspection, app.id, SETTING, "recovery");
  await invokeAction(app, "seed");

  const timer = (await loadRenderSnapshot(app)).timers[TIMER];
  if (timer === undefined) {
    throw new Error("The recovery diagnostic could not start its durable timer.");
  }

  const checkpoint: TimerRecoveryCheckpoint = {
    appId: app.id,
    appName: app.inspection.manifest.name,
    source: app.source,
    startedAt: timer.startedAt,
    preparedAt: new Date().toISOString(),
    launchId: HOST_LAUNCH_ID,
  };
  await saveTimerRecoveryCheckpoint(checkpoint);

  return {
    checkpoint,
    check: {
      id: "timer-recovery-pending",
      title: "Durable timer recovery is ready",
      status: "pending",
      detail:
        "Force-stop Pocket Tools, confirm its process is gone, wait at least one second, reopen it, and resume this test.",
    },
  };
}

export async function resumeTimerRecoveryDiagnostic(): Promise<DiagnosticCheck> {
  const checkpoint = await loadTimerRecoveryCheckpoint();
  if (checkpoint === null) {
    return {
      id: "timer-recovery-missing",
      title: "No timer recovery test is pending",
      status: "pending",
      detail: "Prepare the force-stop test first.",
    };
  }

  if (checkpoint.launchId === HOST_LAUNCH_ID) {
    return {
      id: "timer-recovery-pending",
      title: "Host relaunch still required",
      status: "pending",
      detail:
        "This is still the host launch that prepared the checkpoint. Force-stop and reopen Pocket Tools before resuming; the checkpoint has been preserved.",
    };
  }

  try {
    const inspection = await inspectMiniApp(checkpoint.source);
    if (inspection.manifest.id !== checkpoint.appId) {
      throw new Error("The recovery fixture manifest no longer matches its saved checkpoint.");
    }
    if ((await getInstalledMiniApp(checkpoint.appId)) === null) {
      throw new Error("The temporary installed diagnostic app did not survive relaunch.");
    }

    const app: DiagnosticApp = {
      id: checkpoint.appId,
      source: checkpoint.source,
      inspection,
    };
    const timer = (await loadRenderSnapshot(app)).timers[TIMER];
    if (timer === undefined) {
      throw new Error("The active timer did not survive process termination and relaunch.");
    }
    if (timer.startedAt !== checkpoint.startedAt) {
      throw new Error("The recovered timer start timestamp changed across relaunch.");
    }

    const expectedElapsed = elapsedSecondsSince(checkpoint.startedAt);
    if (timer.elapsedSeconds < 1) {
      throw new Error(
        "The recovered timer did not include at least one second outside the process.",
      );
    }
    if (Math.abs(timer.elapsedSeconds - expectedElapsed) > 2) {
      throw new Error("The recovered elapsed time does not match the persisted start timestamp.");
    }

    await invokeAction(app, "stopTimer");
    if ((await loadRenderSnapshot(app)).timers[TIMER] !== undefined) {
      throw new Error("The recovered timer could not be stopped normally after relaunch.");
    }

    return passed(
      "timer-recovery",
      "Durable timer recovered after relaunch",
      `A new host launch preserved ${timer.startedAt} and reconstructed ${timer.elapsedSeconds.toFixed(1)} seconds from the persisted timestamp.`,
    );
  } catch (caught) {
    return failed("timer-recovery", "Durable timer recovery failed", errorMessage(caught));
  } finally {
    await cleanupDiagnosticApp(checkpoint.appId);
    await clearTimerRecoveryCheckpoint();
  }
}

export function getPendingTimerRecoveryCheckpoint(): Promise<TimerRecoveryCheckpoint | null> {
  return loadTimerRecoveryCheckpoint();
}

export async function resetLifecycleDiagnostics(): Promise<void> {
  const checkpoint = await loadTimerRecoveryCheckpoint();
  if (checkpoint !== null) await cleanupDiagnosticApp(checkpoint.appId);
  await clearTimerRecoveryCheckpoint();
}

async function createDiagnosticApp(id: string, name: string): Promise<DiagnosticApp> {
  const source = createLifecycleDiagnosticSource(id, name);
  return {
    id,
    source,
    inspection: await inspectMiniApp(source),
  };
}

async function installDiagnosticApp(app: DiagnosticApp): Promise<void> {
  await installMiniApp(app.inspection, app.source);
  await ensureSettingDefaults(app.inspection, app.id);
}

async function invokeAction(app: DiagnosticApp, action: string): Promise<void> {
  const snapshot = await loadRuntimeSnapshot(app.inspection, app.id, "action", { action });
  const response = await invokeMiniAppAction(app.source, snapshot);
  await applyRuntimeOperations(app.inspection, app.id, response.value.operations);
}

async function renderDiagnosticScreen(app: DiagnosticApp, screen: string): Promise<void> {
  const snapshot = await loadRuntimeSnapshot(app.inspection, app.id, "render", { screen });
  const response = await renderMiniApp(app.source, snapshot);
  const page = response.value.page;
  if (page === undefined) {
    throw new Error(`The diagnostic screen ${screen} returned no page.`);
  }
  validatePageNode(page, app.inspection);
}

function loadRenderSnapshot(app: DiagnosticApp): Promise<RuntimeSnapshot> {
  return loadRuntimeSnapshot(app.inspection, app.id, "render", {
    screen: "home",
  });
}

function cleanupDiagnosticApp(appId: string): Promise<void> {
  return deleteInstalledMiniApp(appId, true);
}

function assertIsolatedSnapshot(
  snapshot: RuntimeSnapshot,
  expectedValue: string,
  expectedRecordCount: number,
): void {
  if (snapshot.settings[SETTING] !== expectedValue) {
    throw new Error(
      `Expected setting ${expectedValue}, received ${String(snapshot.settings[SETTING])}.`,
    );
  }

  const records = snapshot.records[COLLECTION] ?? [];
  if (
    records.length !== expectedRecordCount ||
    records.some((record) => record.value !== expectedValue)
  ) {
    throw new Error(`Expected ${expectedRecordCount} isolated ${expectedValue} record(s).`);
  }
  if (snapshot.timers[TIMER] === undefined) {
    throw new Error(`Expected the ${expectedValue} timer namespace to be active.`);
  }
}

function assertSamePersistedState(before: RuntimeSnapshot, after: RuntimeSnapshot): void {
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    throw new Error("The operation changed settings unexpectedly.");
  }
  if (JSON.stringify(before.records) !== JSON.stringify(after.records)) {
    throw new Error("The operation changed records unexpectedly.");
  }

  const startedAtValues = (snapshot: RuntimeSnapshot) =>
    Object.fromEntries(Object.entries(snapshot.timers).map(([id, timer]) => [id, timer.startedAt]));
  if (JSON.stringify(startedAtValues(before)) !== JSON.stringify(startedAtValues(after))) {
    throw new Error("The operation changed timers unexpectedly.");
  }
}

function createDiagnosticSuffix(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0x1_0000_0000).toString(36)}`;
}

function passed(id: string, title: string, detail: string): DiagnosticCheck {
  return { id, title, status: "passed", detail };
}

function failed(id: string, title: string, detail: string): DiagnosticCheck {
  return { id, title, status: "failed", detail };
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
