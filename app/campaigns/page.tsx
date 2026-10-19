import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CAMPAIGNS, getProgressPercent } from '@/lib/campaigns/data';

export const metadata: Metadata = { title: 'Ecosystem Campaigns' };

export default function CampaignsPage() {
  const charityCampaigns = CAMPAIGNS.filter((c) => c.charity);
  const otherCampaigns = CAMPAIGNS.filter((c) => !c.charity);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ecosystem Campaigns</h1>
          <p className="text-muted-foreground">
            Time-limited campaigns to save endangered forests, boosted by corporate matching.
          </p>
        </div>
        <Link
          href="/charity-portal"
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Charity &amp; NGO Partnership Portal
        </Link>
      </div>

      {charityCampaigns.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Charity-Code Fundraising</h2>
            <Badge variant="secondary">{charityCampaigns.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Support partner charities and NGOs by using their charity code when you donate.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {charityCampaigns.map((c) => (
              <Link key={c.slug} href={`/campaigns/${c.slug}`}>
                <Card className="h-full p-6 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{c.ecosystem}</Badge>
                    <Badge>{c.matchMultiplier}x match</Badge>
                  </div>
                  <h2 className="text-xl font-semibold">{c.title}</h2>
                  <p className="text-sm text-muted-foreground">{c.location}</p>
                  {c.charity && (
                    <div className="flex items-center gap-2">
                      {c.charity.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.charity.logoUrl}
                          alt={`${c.charity.name} logo`}
                          className="h-6 w-6 rounded-full object-contain"
                        />
                      ) : null}
                      <Badge variant="outline">{c.charity.name}</Badge>
                      {c.charity.charityCode && (
                        <span className="text-xs text-muted-foreground">
                          Code: {c.charity.charityCode}
                        </span>
                      )}
                    </div>
                  )}
                  <Progress value={getProgressPercent(c)} />
                  <p className="text-sm">{getProgressPercent(c)}% funded</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">All Campaigns</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {otherCampaigns.map((c) => (
            <Link key={c.slug} href={`/campaigns/${c.slug}`}>
              <Card className="h-full p-6 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{c.ecosystem}</Badge>
                  <Badge>{c.matchMultiplier}x match</Badge>
                </div>
                <h2 className="text-xl font-semibold">{c.title}</h2>
                <p className="text-sm text-muted-foreground">{c.location}</p>
                <Progress value={getProgressPercent(c)} />
                <p className="text-sm">{getProgressPercent(c)}% funded</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}