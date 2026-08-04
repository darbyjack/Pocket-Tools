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
