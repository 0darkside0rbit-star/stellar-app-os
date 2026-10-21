import { mockAllTimeSponsors } from '@/lib/api/mock/leaderboard';
import type { SponsorBadge } from '@/lib/types/sponsor-badge';
import { getSponsorBadges } from '@/lib/gamification/sponsor-badges';
import { fetchTrees } from '@/lib/api/trees';
import type { Tree } from '@/lib/types/tree';

export interface SponsorProfile {
  address: string;
  name?: string;
  avatarUrl?: string;
  totalTrees: number;
  co2Offset: number;
  badges: SponsorBadge[];
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
 * Returns the trees sponsored by the given address.
 *
 * Used by the monthly forest health newsletter to build the personalised
 * section showing the subscriber's own tree updates.
 */
export async function getSponsorTreeUpdates(address: string): Promise<Tree[]> {
  if (!address) return [];

  const normalized = address.toLowerCase();

  const trees = await fetchTrees({ sponsor: address });

  return trees.filter(
    (tree) => tree.sponsor?.toLowerCase() === normalized
  );
}