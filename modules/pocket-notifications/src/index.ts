import { requireNativeModule } from "expo-modules-core";

import type {
  NativeNotificationOpenTarget,
  NativeNotificationReconciliationResult,
  NativeNotificationRegistryEntry,
} from "./types.ts";
import {
  parseNativeNotificationOpenTarget,
  parseNativeNotificationResults,
} from "./validation.ts";

export type {
  NativeNotificationOpenTarget,
  NativeNotificationReconciliationResult,
  NativeNotificationRegistryEntry,
  NativeNotificationResultStatus,
} from "./types.ts";

interface PocketNotificationsNativeModule {
  readonly ensureChannel: () => void;
  readonly notificationsEnabled: () => boolean;
  readonly canScheduleExactAlarms: () => boolean;
  readonly openNotificationSettings: () => Promise<boolean>;
  readonly openExactAlarmSettings: () => Promise<boolean>;
  readonly reconcile: (entriesJson: string) => Promise<string>;
  readonly getOpenTarget: (hostId: string) => string | null;
}

const nativeModule = requireNativeModule<PocketNotificationsNativeModule>("PocketNotifications");

export function ensureNativeNotificationChannel(): void {
  nativeModule.ensureChannel();
}

export function nativeNotificationsEnabled(): boolean {
  return nativeModule.notificationsEnabled();
}

export function canScheduleExactAlarms(): boolean {
  return nativeModule.canScheduleExactAlarms();
}

export function openNotificationSettings(): Promise<boolean> {
  return nativeModule.openNotificationSettings();
}

export function openExactAlarmSettings(): Promise<boolean> {
  return nativeModule.openExactAlarmSettings();
}

export async function reconcileNativeNotifications(
  entries: readonly NativeNotificationRegistryEntry[],
): Promise<readonly NativeNotificationReconciliationResult[]> {
  return parseNativeNotificationResults(await nativeModule.reconcile(JSON.stringify(entries)));
}

export function getNativeNotificationOpenTarget(
  hostId: string,
): NativeNotificationOpenTarget | null {
  return parseNativeNotificationOpenTarget(nativeModule.getOpenTarget(hostId));
}
