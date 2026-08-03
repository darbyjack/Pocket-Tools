import { useCallback, useEffect, useState } from "react";

import { BATHROOM_PAY_SOURCE } from "./generated/bathroom-pay-source";
import type {
  MiniAppInspection,
  PageNode,
  RuntimeSnapshot,
  SerializableValue,
} from "./model";
import {
  inspectMiniApp,
  invokeMiniAppAction,
  renderMiniApp,
} from "./runtime/quickjs";
import {
  applyRuntimeOperations,
  ensureSettingDefaults,
  initializeDatabase,
  loadRuntimeSnapshot,
  setSetting,
} from "./storage/database";

interface BathroomPayState {
  readonly error: string | null;
  readonly inspection: MiniAppInspection | null;
  readonly loading: boolean;
  readonly page: PageNode | null;
  readonly snapshot: RuntimeSnapshot | null;
  readonly invokeAction: (action: string) => Promise<void>;
  readonly updateSetting: (name: string, value: SerializableValue) => Promise<void>;
}

export function useBathroomPay(): BathroomPayState {
  const [inspection, setInspection] = useState<MiniAppInspection | null>(null);
  const [page, setPage] = useState<PageNode | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (currentInspection: MiniAppInspection) => {
    const nextSnapshot = await loadRuntimeSnapshot(currentInspection, "render");
    const response = await renderMiniApp(BATHROOM_PAY_SOURCE, nextSnapshot);
    if (response.value.page === undefined) {
      throw new Error("QuickJS did not return a page.");
    }
    setSnapshot(nextSnapshot);
    setPage(response.value.page);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initializeDatabase();
        const nextInspection = await inspectMiniApp(BATHROOM_PAY_SOURCE);
        await ensureSettingDefaults(nextInspection);
        if (cancelled) return;
        setInspection(nextInspection);
        await refresh(nextInspection);
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
  }, [refresh]);

  const invokeAction = useCallback(
    async (action: string) => {
      if (inspection === null) return;
      setError(null);
      try {
        const actionSnapshot = await loadRuntimeSnapshot(inspection, "action", {
          action,
        });
        const response = await invokeMiniAppAction(
          BATHROOM_PAY_SOURCE,
          actionSnapshot,
        );
        await applyRuntimeOperations(inspection, response.value.operations);
        await refresh(inspection);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [inspection, refresh],
  );

  const updateSetting = useCallback(
    async (name: string, value: SerializableValue) => {
      if (inspection === null) return;
      setError(null);
      try {
        await setSetting(inspection.manifest.id, name, value);
        await refresh(inspection);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [inspection, refresh],
  );

  return {
    error,
    inspection,
    loading,
    page,
    snapshot,
    invokeAction,
    updateSetting,
  };
}
