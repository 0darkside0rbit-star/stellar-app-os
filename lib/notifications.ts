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

// ---------------------------------------------------------------------------
// Monthly forest health newsletter
// ---------------------------------------------------------------------------

export interface NewsletterTreeUpdate {
  treeId: string;
  species?: string;
  plantedAt?: string;
  location?: string;
  healthStatus?: string;
  co2OffsetKg?: number;
}

export interface NewsletterSection {
  heading: string;
  body: string;
  items?: string[];
}

export interface NewsletterContent {
  subject: string;
  platformNews: NewsletterSection;
  featuredStories: NewsletterSection;
  speciesSpotlights: NewsletterSection;
  conservationTips: NewsletterSection;
  personalised?: NewsletterSection;
}

export interface NewsletterPreferences {
  newsletterOptIn: boolean;
  updatedAt?: string;
}

const NEWSLETTER_PREFERENCES_KEY = 'forest-newsletter-preferences';

/**
 * Fetches the sponsor's trees and builds a personalised tree-update section
 * for the monthly newsletter. Returns `undefined` when the sponsor has no
 * trees or the data cannot be loaded.
 */
export async function buildPersonalisedNewsletterSection(
  sponsorAddress: string
): Promise<NewsletterSection | undefined> {
  if (!sponsorAddress) {
    return undefined;
  }

  try {
    const { fetchSponsorTrees } = await import('./api/sponsors/useSponsorTrees');
    const trees = await fetchSponsorTrees(sponsorAddress);

    if (!trees || trees.length === 0) {
      return undefined;
    }

    const items = trees.map((tree: NewsletterTreeUpdate) => {
      const parts: string[] = [];
      if (tree.species) parts.push(tree.species);
      if (tree.location) parts.push(`planted in ${tree.location}`);
      if (tree.healthStatus) parts.push(`health: ${tree.healthStatus}`);
      if (typeof tree.co2OffsetKg === 'number') {
        parts.push(`${tree.co2OffsetKg.toFixed(1)} kg CO₂ offset`);
      }
      return parts.length > 0 ? parts.join(' — ') : `Tree ${tree.treeId}`;
    });

    return {
      heading: 'Your Trees This Month',
      body: `Here is the latest update on the ${trees.length} tree${
        trees.length === 1 ? '' : 's'
      } you have sponsored.`,
      items,
    };
  } catch (error) {
    console.error('Failed to build personalised newsletter section:', error);
    return undefined;
  }
}

/**
 * Reads the sponsor's newsletter opt-in preference from local storage.
 * Defaults to opted-in when no preference has been stored.
 */
export function getNewsletterPreferences(): NewsletterPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { newsletterOptIn: true };
  }

  try {
    const raw = window.localStorage.getItem(NEWSLETTER_PREFERENCES_KEY);
    if (!raw) {
      return { newsletterOptIn: true };
    }
    const parsed = JSON.parse(raw) as Partial<NewsletterPreferences>;
    return {
      newsletterOptIn: parsed.newsletterOptIn !== false,
      updatedAt: parsed.updatedAt,
    };
  } catch (error) {
    console.error('Failed to read newsletter preferences:', error);
    return { newsletterOptIn: true };
  }
}

/**
 * Persists the sponsor's newsletter opt-in/out preference.
 */
export function setNewsletterOptIn(optIn: boolean): NewsletterPreferences {
  const preferences: NewsletterPreferences = {
    newsletterOptIn: optIn,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        NEWSLETTER_PREFERENCES_KEY,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('Failed to save newsletter preferences:', error);
    }
  }

  return preferences;
}

export function isNewsletterOptedIn(): boolean {
  return getNewsletterPreferences().newsletterOptIn;
}

/**
 * Composes the monthly newsletter content, including the personalised
 * tree-update section when a sponsor address is provided.
 */
export async function composeMonthlyNewsletter(
  sponsorAddress?: string
): Promise<NewsletterContent> {
  const content: NewsletterContent = {
    subject: 'Forest Health Monthly — Your Impact & Platform News',
    platformNews: {
      heading: 'Platform News',
      body: 'Catch up on the latest features and improvements to the platform.',
      items: [
        'New sponsor dashboard with real-time tree tracking',
        'Improved verification workflow for planted trees',
      ],
    },
    featuredStories: {
      heading: 'Featured Reforestation Stories',
      body: 'Inspiring stories from reforestation projects around the world.',
      items: [
        'Community-led mangrove restoration restores coastal habitats',
        'Native species reintroduction boosts biodiversity in the highlands',
      ],
    },
    speciesSpotlights: {
      heading: 'Species Spotlight',
      body: 'Meet the species making a difference in our reforestation efforts.',
      items: [
        'Moringa oleifera — fast-growing and drought resilient',
        'Quercus robur — a cornerstone of temperate forests',
      ],
    },
    conservationTips: {
      heading: 'Conservation Tips',
      body: 'Small actions that make a big difference for forest health.',
      items: [
        'Support local nurseries that grow native species',
        'Reduce paper waste by going digital where possible',
      ],
    },
  };

  if (sponsorAddress) {
    const personalised = await buildPersonalisedNewsletterSection(sponsorAddress);
    if (personalised) {
      content.personalised = personalised;
    }
  }

  return content;
}

/**
 * Sends the monthly newsletter to opted-in sponsors.
 *
 * NOTE: This is a stub. Delivery is expected to be handled by a backend
 * scheduler; this function composes the content and returns it so a caller
 * can dispatch it.
 */
export async function sendMonthlyNewsletter(
  sponsorAddresses: string[]
): Promise<{ sent: number; skipped: number; content: NewsletterContent }> {
  const optedIn = isNewsletterOptedIn();
  const content = await composeMonthlyNewsletter(sponsorAddresses[0]);

  if (!optedIn) {
    return { sent: 0, skipped: sponsorAddresses.length, content };
  }

  // TODO: dispatch via backend newsletter service.
  return { sent: sponsorAddresses.length, skipped: 0, content };
}

/**
 * Schedules the monthly newsletter. Stub that delegates to the backend
 * scheduler when available.
 */
export async function scheduleMonthlyNewsletter(
  sponsorAddresses: string[]
): Promise<{ scheduled: boolean; nextSendAt: string }> {
  const now = new Date();
  const nextSendAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 9, 0, 0)
  ).toISOString();

  // TODO: register the schedule with the backend newsletter service.
  console.info(
    `Monthly newsletter scheduled for ${nextSendAt} to ${sponsorAddresses.length} sponsor(s)`
  );

  return { scheduled: true, nextSendAt };
}
