import { requireNativeModule } from "expo-modules-core";

export type NativeNotificationResultStatus =
  | "scheduled"
  | "blocked"
  | "failed"
  | "cancelled"
  | "delivered"
  | "expired";

export interface NativeNotificationRegistryEntry {
  readonly hostId: string;
  readonly storageId: string;
  readonly notificationId: string;
  readonly desired: boolean;
  readonly request?: Readonly<Record<string, unknown>>;
}

export interface NativeNotificationReconciliationResult {
  readonly hostId: string;
  readonly storageId: string;
  readonly notificationId: string;
  readonly status: NativeNotificationResultStatus;
  readonly platformId?: string;
  readonly message?: string;
}

export interface NativeNotificationOpenTarget {
  readonly hostId: string;
  readonly storageId: string;
  readonly notificationId: string;
  readonly screen?: string;
  readonly input?: unknown;
}

interface PocketNotificationsNativeModule {
  readonly ensureChannel: () => void;
  readonly notificationsEnabled: () => boolean;
  readonly canScheduleExactAlarms: () => boolean;
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

export function openExactAlarmSettings(): Promise<boolean> {
  return nativeModule.openExactAlarmSettings();
}

export async function reconcileNativeNotifications(
  entries: readonly NativeNotificationRegistryEntry[],
): Promise<readonly NativeNotificationReconciliationResult[]> {
  const result = await nativeModule.reconcile(JSON.stringify(entries));
  const parsed = JSON.parse(result) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("NOTIFICATION_RECONCILIATION_FAILED: Native reconciliation returned invalid data.");
  }
  return parsed as readonly NativeNotificationReconciliationResult[];
}

export function getNativeNotificationOpenTarget(
  hostId: string,
): NativeNotificationOpenTarget | null {
  const json = nativeModule.getOpenTarget(hostId);
  if (json === null) return null;
  const parsed = JSON.parse(json) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native notification routing data is invalid.");
  }
  return parsed as NativeNotificationOpenTarget;
}
