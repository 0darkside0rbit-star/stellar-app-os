export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported');
    return null;
  }

  // Check if VAPID key is available
  const vapidKey =
    typeof window !== 'undefined'
      ? (window as typeof window & { ENV?: { NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string } }).ENV
          ?.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      : undefined;

  if (!vapidKey) {
    console.warn('VAPID public key not configured');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      return await subscription.unsubscribe();
    }

    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  // Return as BufferSource compatible type
  return new Uint8Array(outputArray.buffer);
}

export function showNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  navigator.serviceWorker.ready.then((registration) => {
    registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options,
    });
  });
}

export type TreeLifecycleNotificationEventType =
  | 'tree_planted'
  | 'survival_1_year'
  | 'milestone_5_year'
  | 'sponsor_achievement';

export interface TreeLifecycleNotificationEvent {
  type: TreeLifecycleNotificationEventType;
  treeId?: string;
  sponsorId?: string;
  title: string;
  body: string;
  url?: string;
  achievementId?: string;
  data?: Record<string, unknown>;
}

export interface AnnualImpactEmailPayload {
  sponsorId: string;
  sponsorName: string;
  sponsorEmail: string;
  year: number;
  treesFunded: number;
  co2AbsorbedKg: number;
  speciesDiversity: number;
  milestones: string[];
  impactImageUrl?: string;
}

export interface WaitlistAssignmentEmailPayload {
  sponsorId: string;
  sponsorName: string;
  sponsorEmail: string;
  zoneId: string;
  zoneName: string;
  treeId: string;
  waitlistPosition?: number;
}

async function postJson<TResponse = unknown>(
  endpoint: string,
  payload: unknown
): Promise<TResponse | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Request to ${endpoint} failed with status ${response.status}`);
      return null;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    console.error(`Request to ${endpoint} failed:`, error);
    return null;
  }
}

/**
 * Dispatch a real-time tree lifecycle / sponsor achievement push notification.
 * Falls back to an in-app notification when push delivery is unavailable.
 */
export async function dispatchPushNotification(
  event: TreeLifecycleNotificationEvent
): Promise<boolean> {
  const result = await postJson<{ success?: boolean }>('/api/notifications/push', event);

  if (!result) {
    showNotification(event.title, {
      body: event.body,
      data: { url: event.url, ...event.data },
    });
    return false;
  }

  return result.success !== false;
}

/**
 * Send the year-end annual impact summary email for a sponsor.
 * Intended to be invoked by the December 20 scheduled job.
 */
export async function sendAnnualImpactEmail(
  payload: AnnualImpactEmailPayload
): Promise<boolean> {
  const result = await postJson<{ success?: boolean }>('/api/sponsors/annual-impact', payload);
  return result?.success !== false && result !== null;
}

/**
 * Notify a sponsor that a tree has been assigned to them from a zone waitlist.
 */
export async function sendWaitlistAssignmentEmail(
  payload: WaitlistAssignmentEmailPayload
): Promise<boolean> {
  const result = await postJson<{ success?: boolean }>(
    '/api/sponsors/waitlist/notify',
    payload
  );
  return result?.success !== false && result !== null;
}
