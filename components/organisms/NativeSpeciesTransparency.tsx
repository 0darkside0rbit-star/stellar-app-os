import { Leaf, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/molecules/Card';
import { calculateNativeSpeciesRatio, MINIMUM_NATIVE_SPECIES_RATIO } from '@/lib/native-species';

interface NativeSpeciesTransparencyProps {
  nativeTrees?: number;
  totalTrees?: number;
}

export function NativeSpeciesTransparency({
  nativeTrees = 920,
  totalTrees = 1000,
}: NativeSpeciesTransparencyProps) {
  const ratio = calculateNativeSpeciesRatio(nativeTrees, totalTrees);
  return (
    <Card className="border-stellar-green/20" aria-labelledby="native-species-title">
      <CardHeader>
        <CardTitle id="native-species-title" className="flex items-center gap-2 text-xl">
          <Leaf className="h-5 w-5 text-stellar-green" aria-hidden="true" /> Native species priority
        </CardTitle>
        <CardDescription>
          Projects prioritize locally appropriate native species and report the mix transparently.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-bold text-stellar-green">
              {ratio.nativePercentage.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">of planted trees are native</p>
          </div>
          <Badge variant={ratio.meetsPolicy ? 'success' : 'destructive'}>
            {ratio.meetsPolicy ? 'Policy met' : 'Below policy minimum'}
          </Badge>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-muted"
          aria-label={`${ratio.nativePercentage.toFixed(1)} percent native trees`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ratio.nativePercentage}
        >
          <div
            className="h-full rounded-full bg-stellar-green"
            style={{ width: `${ratio.nativePercentage}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-stellar-green/10 p-3">
            <strong>{ratio.nativeTrees.toLocaleString()}</strong>
            <span className="ml-1 text-muted-foreground">native</span>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <strong>{ratio.nonNativeTrees.toLocaleString()}</strong>
            <span className="ml-1 text-muted-foreground">non-native</span>
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-stellar-green" aria-hidden="true" />{' '}
          Platform policy requires at least {MINIMUM_NATIVE_SPECIES_RATIO}% native trees in
          restoration projects. Exceptions must be documented for ecosystem fit.
        </p>
      </CardContent>
    </Card>
  );
}
