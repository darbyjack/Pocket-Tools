import type { MiniAppInspection, RuntimeSnapshot } from "../model";
import {
  inspectMiniApp,
  invokeMiniAppAction,
} from "../runtime/quickjs";
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
import {
  createLifecycleDiagnosticSource,
  DIAGNOSTIC_APP_ID_PREFIX,
} from "./fixtures";
import type { DiagnosticCheck, TimerRecoveryCheckpoint } from "./types";

const SETTING = "sharedValue";
const COLLECTION = "sharedRecords";
const TIMER = "sharedTimer";

export async function runNamespaceIsolationDiagnostics(): Promise<readonly DiagnosticCheck[]> {
  const suffix = createDiagnosticSuffix();
  const [appA, appB] = await Promise.all([
    createDiagnosticApp(
      `${DIAGNOSTIC_APP_ID_PREFIX}${suffix}-a`,
      "Lifecycle Diagnostic A",
    ),
    createDiagnosticApp(
      `${DIAGNOSTIC_APP_ID_PREFIX}${suffix}-b`,
      "Lifecycle Diagnostic B",
    ),
  ]);
  const checks: DiagnosticCheck[] = [];

  try {
    await cleanupDiagnosticApp(appA.id);
    await cleanupDiagnosticApp(appB.id);
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
    assertIsolatedSnapshot(snapshotA, "alpha");
    assertIsolatedSnapshot(snapshotB, "beta");
    checks.push(
      passed(
        "namespace-isolation",
        "Settings, records, and timers are isolated",
        "Two installed scripts used identical setting, collection, and timer names without observing each other’s values.",
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
    if ((afterRecovery.records[COLLECTION]?.length ?? 0) !== 2) {
      throw new Error(
        "A valid invocation did not succeed after the intentional failure.",
      );
    }
    checks.push(
      passed(
        "failure-recovery",
        "A failed invocation does not poison later work",
        "The failing action persisted nothing, and a following action completed through a fresh QuickJS runtime.",
      ),
    );

    await deleteInstalledMiniApp(appA.id, false);
    if ((await getInstalledMiniApp(appA.id)) !== null) {
      throw new Error(
        "Remove-with-retained-data left the installation record behind.",
      );
    }
    const retained = await loadRenderSnapshot(appA);
    assertIsolatedSnapshot(retained, "alpha");

    await installMiniApp(appA.inspection, appA.source);
    const restored = await loadRenderSnapshot(appA);
    assertIsolatedSnapshot(restored, "alpha");

    await deleteInstalledMiniApp(appA.id, true);
    const cleared = await loadRenderSnapshot(appA);
    if (
      Object.keys(cleared.settings).length !== 0 ||
      (cleared.records[COLLECTION]?.length ?? 0) !== 0 ||
      Object.keys(cleared.timers).length !== 0
    ) {
      throw new Error(
        "Remove-with-data did not clear the complete app namespace.",
      );
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
      failed(
        "diagnostic-suite",
        "Lifecycle diagnostic suite failed",
        caught instanceof Error ? caught.message : String(caught),
      ),
    );
  } finally {
    await Promise.allSettled([
      cleanupDiagnosticApp(appA.id),
      cleanupDiagnosticApp(appB.id),
    ]);
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

  const suffix = createDiagnosticSuffix();
  const app = await createDiagnosticApp(
    `${DIAGNOSTIC_APP_ID_PREFIX}${suffix}-recovery`,
    "Timer Recovery Diagnostic",
  );
  await installDiagnosticApp(app);
  await setSetting(app.inspection, app.id, SETTING, "recovery");
  await invokeAction(app, "seed");
  const snapshot = await loadRenderSnapshot(app);
  const timer = snapshot.timers[TIMER];
  if (timer === undefined) {
    throw new Error(
      "The recovery diagnostic could not start its durable timer.",
    );
  }

  const checkpoint: TimerRecoveryCheckpoint = {
    appId: app.id,
    appName: app.inspection.manifest.name,
    source: app.source,
    startedAt: timer.startedAt,
    preparedAt: new Date().toISOString(),
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

  try {
    const inspection = await inspectMiniApp(checkpoint.source);
    if (inspection.manifest.id !== checkpoint.appId) {
      throw new Error(
        "The recovery fixture manifest no longer matches its saved checkpoint.",
      );
    }
    if ((await getInstalledMiniApp(checkpoint.appId)) === null) {
      throw new Error(
        "The temporary installed diagnostic app did not survive relaunch.",
      );
    }

    const app: DiagnosticApp = {
      id: checkpoint.appId,
      source: checkpoint.source,
      inspection,
    };
    const snapshot = await loadRenderSnapshot(app);
    const timer = snapshot.timers[TIMER];
    if (timer === undefined) {
      throw new Error(
        "The active timer did not survive process termination and relaunch.",
      );
    }
    if (timer.startedAt !== checkpoint.startedAt) {
      throw new Error(
        "The recovered timer start timestamp changed across relaunch.",
      );
    }

    const expectedElapsed = elapsedSecondsSince(checkpoint.startedAt);
    if (timer.elapsedSeconds < 1) {
      throw new Error(
        "The recovered timer did not include at least one second outside the process.",
      );
    }
    if (Math.abs(timer.elapsedSeconds - expectedElapsed) > 2) {
      throw new Error(
        "The recovered elapsed time does not match the persisted start timestamp.",
      );
    }

    await invokeAction(app, "stopTimer");
    const stopped = await loadRenderSnapshot(app);
    if (stopped.timers[TIMER] !== undefined) {
      throw new Error(
        "The recovered timer could not be stopped normally after relaunch.",
      );
    }

    return passed(
      "timer-recovery",
      "Durable timer recovered after relaunch",
      `The timer preserved ${timer.startedAt} and reconstructed ${timer.elapsedSeconds.toFixed(1)} seconds without keeping QuickJS state alive.`,
    );
  } catch (caught) {
    return failed(
      "timer-recovery",
      "Durable timer recovery failed",
      caught instanceof Error ? caught.message : String(caught),
    );
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

interface DiagnosticApp {
  readonly id: string;
  readonly source: string;
  readonly inspection: MiniAppInspection;
}

async function createDiagnosticApp(
  id: string,
  name: string,
): Promise<DiagnosticApp> {
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
  const snapshot = await loadRuntimeSnapshot(
    app.inspection,
    app.id,
    "action",
    { action },
  );
  const response = await invokeMiniAppAction(app.source, snapshot);
  await applyRuntimeOperations(
    app.inspection,
    app.id,
    response.value.operations,
  );
}

function loadRenderSnapshot(app: DiagnosticApp): Promise<RuntimeSnapshot> {
  return loadRuntimeSnapshot(app.inspection, app.id, "render", {
    screen: "home",
  });
}

async function cleanupDiagnosticApp(appId: string): Promise<void> {
  await deleteInstalledMiniApp(appId, true);
}

function assertIsolatedSnapshot(
  snapshot: RuntimeSnapshot,
  expectedValue: string,
): void {
  if (snapshot.settings[SETTING] !== expectedValue) {
    throw new Error(
      `Expected setting ${expectedValue}, received ${String(snapshot.settings[SETTING])}.`,
    );
  }
  const records = snapshot.records[COLLECTION] ?? [];
  if (records.length !== 1 || records[0]?.value !== expectedValue) {
    throw new Error(`Expected one isolated ${expectedValue} record.`);
  }
  if (snapshot.timers[TIMER] === undefined) {
    throw new Error(
      `Expected the ${expectedValue} timer namespace to be active.`,
    );
  }
}

function assertSamePersistedState(
  before: RuntimeSnapshot,
  after: RuntimeSnapshot,
): void {
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    throw new Error("The failed invocation changed settings.");
  }
  if (JSON.stringify(before.records) !== JSON.stringify(after.records)) {
    throw new Error("The failed invocation changed records.");
  }
  const beforeTimers = Object.fromEntries(
    Object.entries(before.timers).map(([id, timer]) => [
      id,
      timer.startedAt,
    ]),
  );
  const afterTimers = Object.fromEntries(
    Object.entries(after.timers).map(([id, timer]) => [
      id,
      timer.startedAt,
    ]),
  );
  if (JSON.stringify(beforeTimers) !== JSON.stringify(afterTimers)) {
    throw new Error("The failed invocation changed timers.");
  }
}

function createDiagnosticSuffix(): string {
  return `${Date.now().toString(36)}-${Math.floor(
    Math.random() * 0x1_0000_0000,
  ).toString(36)}`;
}

function passed(
  id: string,
  title: string,
  detail: string,
): DiagnosticCheck {
  return { id, title, status: "passed", detail };
}

function failed(
  id: string,
  title: string,
  detail: string,
): DiagnosticCheck {
  return { id, title, status: "failed", detail };
}
