import { TREE_SPECIES, type SpeciesInfo } from '@/lib/constants/species';

/** Platform policy: at least 70% of planted trees in restoration projects must be native. */
export const MINIMUM_NATIVE_SPECIES_RATIO = 70;

// Species whose published planting profile is indigenous to the project's supported regions.
const NATIVE_SPECIES_SLUGS = new Set([
  'moringa',
  'mangrove',
  'acacia',
  'neem',
  'mahogany',
  'baobab',
  'cedar',
  'iroko',
  'shea',
  'cashew',
  'locust_bean',
]);

export function isNativeSpecies(slug: string): boolean {
  return NATIVE_SPECIES_SLUGS.has(slug);
}

export function speciesWithNativeStatus(): Array<SpeciesInfo & { isNative: boolean }> {
  return TREE_SPECIES.map((species) => ({ ...species, isNative: isNativeSpecies(species.slug) }));
}

export interface NativeSpeciesRatio {
  nativeTrees: number;
  nonNativeTrees: number;
  totalTrees: number;
  nativePercentage: number;
  meetsPolicy: boolean;
}

export function calculateNativeSpeciesRatio(
  nativeTrees: number,
  totalTrees: number
): NativeSpeciesRatio {
  const safeTotal = Math.max(0, totalTrees);
  const safeNative = Math.min(Math.max(0, nativeTrees), safeTotal);
  const nonNativeTrees = safeTotal - safeNative;
  const nativePercentage = safeTotal === 0 ? 0 : (safeNative / safeTotal) * 100;
  return {
    nativeTrees: safeNative,
    nonNativeTrees,
    totalTrees: safeTotal,
    nativePercentage,
    meetsPolicy: nativePercentage >= MINIMUM_NATIVE_SPECIES_RATIO,
  };
}

export const DEFAULT_PROJECT_NATIVE_COUNTS = { nativeTrees: 920, totalTrees: 1_000 };
