import { mockAllTimeSponsors } from '@/lib/api/mock/leaderboard';
import type { SponsorBadge } from '@/lib/types/sponsor-badge';
import { getSponsorBadges } from '@/lib/gamification/sponsor-badges';

export interface SponsorProfile {
  address: string;
  name?: string;
  avatarUrl?: string;
  totalTrees: number;
  co2Offset: number;
  badges: SponsorBadge[];
}

export interface AnnualImpactSummary {
  sponsorId: string;
  year: number;
  treesFunded: number;
  co2Absorbed: number;
  speciesDiversity: number;
  milestonesReached: string[];
}

export interface AnnualImpactEmailRow {
  sponsorId: string;
  year: number;
  status: 'pending' | 'sent' | 'failed';
}

export interface WaitlistEntry {
  sponsorId: string;
  region: string;
  treeId?: string;
  position: number;
  joinedAt: string;
}

export interface WaitlistAssignment {
  sponsorId: string;
  region: string;
  treeId: string;
  assignedAt: string;
}

const ANNUAL_IMPACT_EMAILS_ENDPOINT = '/api/sponsors/annual-impact-emails';
const WAITLIST_ENDPOINT = '/api/sponsors/waitlist';

// In-memory fallback stores used when the API is unavailable (e.g. tests / offline).
const annualImpactEmailsStore: AnnualImpactEmailRow[] = [];
const waitlistStore: WaitlistEntry[] = [];

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function getSponsorProfile(address: string): SponsorProfile | undefined {
  const sponsor = mockAllTimeSponsors.find(
    (entry) => entry.address.toLowerCase() === address.toLowerCase()
  );

  if (!sponsor) return undefined;

  return {
    ...sponsor,
    badges: getSponsorBadges(sponsor.totalTrees),
  };
}

/**
 * Aggregates a sponsor's year-in-review impact: trees funded, CO2 absorbed,
 * species diversity, and milestones reached during the given year.
 */
export function getSponsorAnnualImpact(
  sponsorId: string,
  year: number
): AnnualImpactSummary | undefined {
  const sponsor = mockAllTimeSponsors.find(
    (entry) => normalizeAddress(entry.address) === normalizeAddress(sponsorId)
  );

  if (!sponsor) return undefined;

  // Derive per-year figures from the sponsor's cumulative totals. In a real
  // implementation these would come from a year-scoped aggregation query.
  const treesFunded = sponsor.totalTrees;
  const co2Absorbed = sponsor.co2Offset;
  const speciesDiversity = Math.max(1, Math.round(treesFunded / 10));

  const milestonesReached: string[] = [];
  if (treesFunded >= 1) milestonesReached.push('First tree funded');
  if (treesFunded >= 10) milestonesReached.push('10 trees funded');
  if (treesFunded >= 50) milestonesReached.push('50 trees funded');
  if (treesFunded >= 100) milestonesReached.push('100 trees funded');
  if (treesFunded >= 500) milestonesReached.push('500 trees funded');
  if (treesFunded >= 1000) milestonesReached.push('1,000 trees funded');

  return {
    sponsorId: sponsor.address,
    year,
    treesFunded,
    co2Absorbed,
    speciesDiversity,
    milestonesReached,
  };
}

/**
 * Creates pending annual_impact_emails rows for every sponsor for the given
 * year. Idempotent per (sponsor, year): existing rows are not duplicated.
 */
export async function enqueueAnnualImpactEmails(
  year: number
): Promise<AnnualImpactEmailRow[]> {
  const created: AnnualImpactEmailRow[] = [];

  for (const sponsor of mockAllTimeSponsors) {
    const sponsorId = sponsor.address;
    const alreadyQueued = annualImpactEmailsStore.some(
      (row) =>
        normalizeAddress(row.sponsorId) === normalizeAddress(sponsorId) &&
        row.year === year
    );

    if (alreadyQueued) continue;

    const row: AnnualImpactEmailRow = {
      sponsorId,
      year,
      status: 'pending',
    };

    annualImpactEmailsStore.push(row);
    created.push(row);
  }

  // Best-effort persistence to the backend; failures fall back to the
  // in-memory store above.
  try {
    await fetch(ANNUAL_IMPACT_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year }),
    });
  } catch {
    // Ignore network errors; rows remain queued in memory.
  }

  return created;
}

/**
 * Adds a sponsor to the waitlist for an oversubscribed planting zone.
 */
export async function joinWaitlist(
  sponsorId: string,
  region: string,
  treeId?: string
): Promise<WaitlistEntry> {
  const existing = waitlistStore.find(
    (entry) =>
      normalizeAddress(entry.sponsorId) === normalizeAddress(sponsorId) &&
      entry.region === region
  );

  if (existing) return existing;

  const position =
    waitlistStore.filter((entry) => entry.region === region).length + 1;

  const entry: WaitlistEntry = {
    sponsorId,
    region,
    treeId,
    position,
    joinedAt: new Date().toISOString(),
  };

  waitlistStore.push(entry);

  try {
    const response = await fetch(`${WAITLIST_ENDPOINT}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId, region, treeId }),
    });

    if (response.ok) {
      const data = (await response.json()) as Partial<WaitlistEntry>;
      return { ...entry, ...data };
    }
  } catch {
    // Ignore network errors; entry remains queued in memory.
  }

  return entry;
}

/**
 * Returns the sponsor's current waitlist position for a region, or null if
 * they are not on the waitlist.
 */
export async function getWaitlistPosition(
  sponsorId: string,
  region: string
): Promise<number | null> {
  try {
    const response = await fetch(
      `${WAITLIST_ENDPOINT}/position?sponsorId=${encodeURIComponent(
        sponsorId
      )}&region=${encodeURIComponent(region)}`
    );

    if (response.ok) {
      const data = (await response.json()) as { position?: number | null };
      if (typeof data.position === 'number') return data.position;
      if (data.position === null) return null;
    }
  } catch {
    // Fall through to in-memory lookup.
  }

  const entry = waitlistStore.find(
    (item) =>
      normalizeAddress(item.sponsorId) === normalizeAddress(sponsorId) &&
      item.region === region
  );

  return entry ? entry.position : null;
}

/**
 * Assigns the next waitlisted sponsor in a region to a tree when a new
 * planting batch opens. Returns the assignment, or null if the waitlist is
 * empty.
 */
export async function assignFromWaitlist(
  region: string
): Promise<WaitlistAssignment | null> {
  try {
    const response = await fetch(`${WAITLIST_ENDPOINT}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region }),
    });

    if (response.ok) {
      const data = (await response.json()) as WaitlistAssignment | null;
      if (data) return data;
    }
  } catch {
    // Fall through to in-memory assignment.
  }

  const index = waitlistStore.findIndex((entry) => entry.region === region);
  if (index === -1) return null;

  const [entry] = waitlistStore.splice(index, 1);

  // Re-number remaining positions in the region.
  let position = 1;
  for (const item of waitlistStore) {
    if (item.region === region) {
      item.position = position++;
    }
  }

  return {
    sponsorId: entry.sponsorId,
    region: entry.region,
    treeId: entry.treeId ?? `tree-${region}-${Date.now()}`,
    assignedAt: new Date().toISOString(),
  };
}