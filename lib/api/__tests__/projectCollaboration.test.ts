import { beforeEach, describe, expect, it } from 'vitest';

import {
  addPartnerOrg,
  assignZones,
  getAdminView,
  getOrgScopedView,
  getUnifiedReport,
  listZonesForOrg,
  resetProjectCollaboration,
  submitZoneEntry,
} from '@/lib/api/projectCollaboration';

const PROJECT = 'proj-collab-1';
const ADMIN = 'G-PROJECT-ADMIN';
const OTHER = 'G-SOMEONE-ELSE';

function addOrg(name: string): string {
  const result = addPartnerOrg(PROJECT, { name }, ADMIN);
  if (!result.ok) throw new Error(`seed org failed: ${result.message}`);
  return result.value.id;
}

function orgZones(orgId: string): string[] {
  return listZonesForOrg(PROJECT, orgId).map((zone) => zone.id);
}

beforeEach(resetProjectCollaboration);

describe('AC1 — project admin adds co-managing organisations', () => {
  it('lets the project admin add partner organisations', () => {
    const result = addPartnerOrg(
      PROJECT,
      { name: 'Green Belt NGO', contactEmail: 'hi@greenbelt.org' },
      ADMIN
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      name: 'Green Belt NGO',
      role: 'data_entry',
      addedById: ADMIN,
      projectId: PROJECT,
    });
    expect(getAdminView(PROJECT, ADMIN)?.orgs).toHaveLength(1);
  });

  it('rejects non-admins and duplicate names', () => {
    // ADMIN claims the project first — lazy seed establishes the admin.
    addOrg('Green Belt NGO');
    expect(addPartnerOrg(PROJECT, { name: 'Sneaky Org' }, OTHER)).toMatchObject({
      ok: false,
      error: 'not_project_admin',
    });
    expect(addPartnerOrg(PROJECT, { name: 'green belt ngo' }, ADMIN)).toMatchObject({
      ok: false,
      error: 'invalid_input',
    });
    expect(addPartnerOrg(PROJECT, { name: '   ' }, ADMIN)).toMatchObject({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('only the admin can assign zones', () => {
    const orgId = addOrg('Zone Org');
    // No zones assigned yet, so the org sees none — take ids from the admin view.
    expect(listZonesForOrg(PROJECT, orgId)).toHaveLength(0);
    const zones = getAdminView(PROJECT, ADMIN)!.zones;
    const denied = assignZones(PROJECT, { orgId, zoneIds: [zones[0].id] }, OTHER);
    expect(denied).toMatchObject({ ok: false, error: 'not_project_admin' });
    expect(assignZones(PROJECT, { orgId, zoneIds: [zones[0].id] }, ADMIN).ok).toBe(true);
  });
});

describe('AC2 — each organisation sees only its assigned zones', () => {
  it('scopes the zone list to the assigned organisation', () => {
    const orgA = addOrg('Org A');
    const orgB = addOrg('Org B');
    const allZones = getAdminView(PROJECT, ADMIN)!.zones;
    expect(allZones.length).toBeGreaterThan(1);

    assignZones(PROJECT, { orgId: orgA, zoneIds: [allZones[0].id] }, ADMIN);
    assignZones(PROJECT, { orgId: orgB, zoneIds: [allZones[1].id] }, ADMIN);

    expect(orgZones(orgA)).toEqual([allZones[0].id]);
    expect(orgZones(orgB)).toEqual([allZones[1].id]);
    expect(orgZones(orgA)).not.toContain(allZones[1].id);
  });

  it('denies data entry for zones outside the organisation’s assignment', () => {
    const orgA = addOrg('Org A');
    const orgB = addOrg('Org B');
    const zones = getAdminView(PROJECT, ADMIN)!.zones;
    assignZones(PROJECT, { orgId: orgA, zoneIds: [zones[0].id] }, ADMIN);

    const denied = submitZoneEntry(PROJECT, {
      orgId: orgB,
      zoneId: zones[0].id,
      treesPlanted: 100,
      areaHectares: 2,
    });
    expect(denied).toMatchObject({ ok: false, error: 'org_not_assigned_to_zone' });

    const allowed = submitZoneEntry(PROJECT, {
      orgId: orgA,
      zoneId: zones[0].id,
      treesPlanted: 100,
      areaHectares: 2.5,
      notes: 'North ridge planted',
    });
    expect(allowed.ok).toBe(true);

    const scoped = getOrgScopedView(PROJECT, orgB)!;
    expect(scoped.entries).toHaveLength(0);
    expect(getOrgScopedView(PROJECT, orgA)!.entries).toHaveLength(1);
  });

  it('rejects invalid entry values and unknown zones', () => {
    const orgA = addOrg('Org A');
    const zones = getAdminView(PROJECT, ADMIN)!.zones;
    assignZones(PROJECT, { orgId: orgA, zoneIds: [zones[0].id] }, ADMIN);

    expect(
      submitZoneEntry(PROJECT, {
        orgId: orgA,
        zoneId: zones[0].id,
        treesPlanted: -5,
        areaHectares: 1,
      })
    ).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(
      submitZoneEntry(PROJECT, {
        orgId: orgA,
        zoneId: 'zone-ghost',
        treesPlanted: 5,
        areaHectares: 1,
      })
    ).toMatchObject({ ok: false, error: 'invalid_zone' });
  });
});

describe('AC3 — unified report aggregates all organisations', () => {
  it('sums entries across orgs with per-org and per-zone breakdowns', () => {
    const orgA = addOrg('Org A');
    const orgB = addOrg('Org B');
    const zones = getAdminView(PROJECT, ADMIN)!.zones;
    assignZones(PROJECT, { orgId: orgA, zoneIds: [zones[0].id] }, ADMIN);
    assignZones(PROJECT, { orgId: orgB, zoneIds: [zones[1].id, zones[2].id] }, ADMIN);

    submitZoneEntry(PROJECT, {
      orgId: orgA,
      zoneId: zones[0].id,
      treesPlanted: 100,
      areaHectares: 2,
    });
    submitZoneEntry(PROJECT, {
      orgId: orgB,
      zoneId: zones[1].id,
      treesPlanted: 250,
      areaHectares: 5,
    });
    submitZoneEntry(PROJECT, {
      orgId: orgB,
      zoneId: zones[2].id,
      treesPlanted: 150,
      areaHectares: 3,
    });

    const report = getUnifiedReport(PROJECT)!;
    expect(report.totals).toMatchObject({
      organisations: 2,
      entries: 3,
      treesPlanted: 500,
      areaHectares: 10,
      zonesAssigned: 3,
    });

    const byA = report.byOrganisation.find((row) => row.orgId === orgA)!;
    const byB = report.byOrganisation.find((row) => row.orgId === orgB)!;
    expect(byA).toMatchObject({ treesPlanted: 100, entries: 1, zones: 1 });
    expect(byB).toMatchObject({ treesPlanted: 400, entries: 2, zones: 2 });

    expect(report.byZone.find((row) => row.zoneId === zones[0].id)).toMatchObject({
      orgName: 'Org A',
      treesPlanted: 100,
    });
    expect(report.byZone.find((row) => row.zoneId === zones[3].id)).toMatchObject({
      orgId: null,
      treesPlanted: 0,
    });
  });

  it('returns null for unknown projects', () => {
    expect(getUnifiedReport('proj-ghost')).toBeNull();
  });
});
