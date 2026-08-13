import { describe, expect, it } from 'vitest';
import { CorpseIndex } from '../../src/game/combat/CorpseIndex';
import { ZOMBIE_CORPSE_POI_TYPE_ID } from '../../src/assets/pessoasMortas';
import {
  lootPresenceChance,
  ResourceManager,
} from '../../src/game/resources/ResourceManager';
import type { City } from '../../src/world/model/types';

function emptyCity(): City {
  return {
    tileSize: 32,
    center: { x: 50, y: 50 },
    grid: { w: 100, h: 100 },
    explorationPoints: [],
    ambientProps: [],
  } as City;
}

describe('zombie corpse loot', () => {
  it('CorpseIndex indexes human POI corpses only', () => {
    const index = CorpseIndex.fromCity(emptyCity());
    expect(index.count).toBe(0);
    index.add({ id: 'poi-corpse-1', x: 100, y: 200 });
    expect(index.count).toBe(1);
  });

  it('registerZombieCorpseLootSite creates loot site with zombie_corpse type', () => {
    const rm = new ResourceManager();
    rm.spawnForCity({} as never, emptyCity(), {} as never);

    const site = rm.registerZombieCorpseLootSite('zombie-corpse-e9', 64, 128, 0.85);
    expect(site.typeId).toBe(ZOMBIE_CORPSE_POI_TYPE_ID);
    expect(site.luck).toBe(0.85);
    expect(rm.probeNearest(64, 128, 48, () => 0)?.site.id).toBe(site.id);
  });

  it('zombie corpse loot uses same regional chance as POI corpse', () => {
    expect(lootPresenceChance(ZOMBIE_CORPSE_POI_TYPE_ID, 0)).toBe(0.7);
    expect(lootPresenceChance(ZOMBIE_CORPSE_POI_TYPE_ID, 1)).toBe(0.95);
  });

  it('zombie corpse ids are distinguishable from human corpses', () => {
    expect('zombie-corpse-e42'.startsWith('zombie-corpse-')).toBe(true);
    expect('poi-corpse-1'.startsWith('zombie-corpse-')).toBe(false);
  });
});
