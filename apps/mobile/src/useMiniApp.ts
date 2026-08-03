import { useCallback, useEffect, useState } from "react";

import type {
  MiniAppInspection,
  PageNode,
  RuntimeSnapshot,
  SerializableValue,
} from "./model";
import {
  formatMiniAppError,
  inspectMiniApp,
  invokeMiniAppAction,
  renderMiniApp,
} from "./runtime/quickjs";
import { validatePageNode } from "./runtime/ui-validation";
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
  readonly screen: string;
  readonly snapshot: RuntimeSnapshot | null;
  readonly invokeAction: (
    action: string,
    input?: SerializableValue,
  ) => Promise<void>;
  readonly navigate: (
    screen: string,
    input?: SerializableValue,
  ) => Promise<void>;
  readonly updateSetting: (name: string, value: SerializableValue) => Promise<void>;
}

interface RenderedMiniApp {
  readonly page: PageNode;
  readonly snapshot: RuntimeSnapshot;
}

export function useMiniApp(
  source: string | null,
  requestedStorageId: string | null = null,
): MiniAppState {
  const [inspection, setInspection] = useState<MiniAppInspection | null>(null);
  const [page, setPage] = useState<PageNode | null>(null);
  const [screen, setScreen] = useState("home");
  const [screenInput, setScreenInput] = useState<SerializableValue | undefined>(
    undefined,
  );
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [loading, setLoading] = useState(source !== null);
  const [error, setError] = useState<string | null>(null);

  const storageIdFor = useCallback(
    (currentInspection: MiniAppInspection) =>
      requestedStorageId ?? currentInspection.manifest.id,
    [requestedStorageId],
  );

  const render = useCallback(
    async (
      currentInspection: MiniAppInspection,
      targetScreen: string,
      targetInput?: SerializableValue,
    ): Promise<RenderedMiniApp> => {
      if (source === null) throw new Error("No mini-app script is selected.");
      if (!currentInspection.screens.includes(targetScreen)) {
        throw new Error(`UNKNOWN_SCREEN: ${targetScreen}`);
      }

      const baseSnapshot = await loadRuntimeSnapshot(
        currentInspection,
        storageIdFor(currentInspection),
        "render",
        { screen: targetScreen },
      );
      const nextSnapshot: RuntimeSnapshot =
        targetInput === undefined
          ? baseSnapshot
          : { ...baseSnapshot, screenInput: targetInput };
      const response = await renderMiniApp(source, nextSnapshot);
      if (response.value.page === undefined) {
        throw new Error("QuickJS did not return a page.");
      }
      validatePageNode(response.value.page, currentInspection);

      return {
        page: response.value.page,
        snapshot: nextSnapshot,
      };
    },
    [source, storageIdFor],
  );

  const refresh = useCallback(
    async (
      currentInspection: MiniAppInspection,
      targetScreen: string,
      targetInput?: SerializableValue,
    ) => {
      const rendered = await render(
        currentInspection,
        targetScreen,
        targetInput,
      );
      setSnapshot(rendered.snapshot);
      setPage(rendered.page);
    },
    [render],
  );

  useEffect(() => {
    let cancelled = false;

    setInspection(null);
    setPage(null);
    setScreen("home");
    setScreenInput(undefined);
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
        if (!nextInspection.screens.includes("home")) {
          throw new Error("INVALID_SCRIPT: A home screen is required.");
        }
        await ensureSettingDefaults(
          nextInspection,
          storageIdFor(nextInspection),
        );
        const rendered = await render(nextInspection, "home");

        if (cancelled) return;
        setInspection(nextInspection);
        setSnapshot(rendered.snapshot);
        setPage(rendered.page);
      } catch (caught) {
        if (!cancelled) setError(formatMiniAppError(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [render, source, storageIdFor]);

  const invokeAction = useCallback(
    async (action: string, input?: SerializableValue) => {
      if (inspection === null || source === null) return;
      setError(null);

      try {
        if (!inspection.actions.includes(action)) {
          throw new Error(`UNKNOWN_ACTION: ${action}`);
        }
        const storageId = storageIdFor(inspection);
        const baseSnapshot = await loadRuntimeSnapshot(
          inspection,
          storageId,
          "action",
          { action },
        );
        const actionSnapshot: RuntimeSnapshot =
          input === undefined
            ? baseSnapshot
            : { ...baseSnapshot, actionInput: input };
        const response = await invokeMiniAppAction(source, actionSnapshot);
        await applyRuntimeOperations(
          inspection,
          storageId,
          response.value.operations,
        );
        await refresh(inspection, screen, screenInput);
      } catch (caught) {
        setError(formatMiniAppError(caught));
      }
    },
    [inspection, refresh, screen, screenInput, source, storageIdFor],
  );

  const navigate = useCallback(
    async (targetScreen: string, input?: SerializableValue) => {
      if (inspection === null) return;
      setError(null);

      try {
        const rendered = await render(inspection, targetScreen, input);
        setScreen(targetScreen);
        setScreenInput(input);
        setSnapshot(rendered.snapshot);
        setPage(rendered.page);
      } catch (caught) {
        setError(formatMiniAppError(caught));
      }
    },
    [inspection, render],
  );

  const updateSetting = useCallback(
    async (name: string, value: SerializableValue) => {
      if (inspection === null) return;
      setError(null);

      try {
        await setSetting(inspection, storageIdFor(inspection), name, value);
        await refresh(inspection, screen, screenInput);
      } catch (caught) {
        setError(formatMiniAppError(caught));
      }
    },
    [inspection, refresh, screen, screenInput, storageIdFor],
  );

  return {
    error,
    inspection,
    loading,
    page,
    screen,
    snapshot,
    invokeAction,
    navigate,
    updateSetting,
  };
}
