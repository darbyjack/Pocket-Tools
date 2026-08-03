import { useCallback, useEffect, useState } from "react";

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

export interface MiniAppState {
  readonly error: string | null;
  readonly inspection: MiniAppInspection | null;
  readonly loading: boolean;
  readonly page: PageNode | null;
  readonly snapshot: RuntimeSnapshot | null;
  readonly invokeAction: (action: string) => Promise<void>;
  readonly updateSetting: (name: string, value: SerializableValue) => Promise<void>;
}

interface RenderedMiniApp {
  readonly page: PageNode;
  readonly snapshot: RuntimeSnapshot;
}

export function useMiniApp(source: string | null): MiniAppState {
  const [inspection, setInspection] = useState<MiniAppInspection | null>(null);
  const [page, setPage] = useState<PageNode | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [loading, setLoading] = useState(source !== null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(
    async (currentInspection: MiniAppInspection): Promise<RenderedMiniApp> => {
      if (source === null) {
        throw new Error("No mini-app script is selected.");
      }

      const nextSnapshot = await loadRuntimeSnapshot(currentInspection, "render");
      const response = await renderMiniApp(source, nextSnapshot);
      if (response.value.page === undefined) {
        throw new Error("QuickJS did not return a page.");
      }

      return {
        page: response.value.page,
        snapshot: nextSnapshot,
      };
    },
    [source],
  );

  const refresh = useCallback(
    async (currentInspection: MiniAppInspection) => {
      const rendered = await render(currentInspection);
      setSnapshot(rendered.snapshot);
      setPage(rendered.page);
    },
    [render],
  );

  useEffect(() => {
    let cancelled = false;

    setInspection(null);
    setPage(null);
    setSnapshot(null);
    setError(null);

    if (source === null) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void (async () => {
      try {
        await initializeDatabase();
        const nextInspection = await inspectMiniApp(source);
        await ensureSettingDefaults(nextInspection);
        const rendered = await render(nextInspection);

        if (cancelled) return;
        setInspection(nextInspection);
        setSnapshot(rendered.snapshot);
        setPage(rendered.page);
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
  }, [render, source]);

  const invokeAction = useCallback(
    async (action: string) => {
      if (inspection === null || source === null) return;
      setError(null);

      try {
        const actionSnapshot = await loadRuntimeSnapshot(inspection, "action", {
          action,
        });
        const response = await invokeMiniAppAction(source, actionSnapshot);
        await applyRuntimeOperations(inspection, response.value.operations);
        await refresh(inspection);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [inspection, refresh, source],
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
