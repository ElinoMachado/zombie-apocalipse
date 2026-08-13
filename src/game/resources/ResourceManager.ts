import Phaser from 'phaser';
import type { City } from '../../world/model/types';
import {
  centerDistanceNorm,
  lerp,
  proximityFromCenter,
} from '../combat/cityThreat';
import { Inventory, type ItemId } from '../inventory/inventory';
import { EquipmentLoadout } from '../inventory/equipmentLoadout';
import { syncInventoryCapacity } from '../inventory/itemActions';
import { SurvivalState } from '../survival/SurvivalState';
import type { WorldCollision } from '../WorldCollision';
import type { LootTalentMods } from '../progression/talentEffects';
import { CAR_POI_TYPE_IDS } from '../../assets/wreckedCars';
import { ZOMBIE_CORPSE_POI_TYPE_ID } from '../../assets/pessoasMortas';
import { rollLootWithIntellect, type LootRollResult } from './lootTable';

/** Chance de loot em POI na periferia/rural (proximity 0). */
export const LOOT_PRESENCE_CHANCE = 0.7;
/** Chance de loot em POI no centro da cidade (proximity 1). */
export const LOOT_PRESENCE_CHANCE_CENTER = 0.95;
/** Carros — periferia/rural. */
export const CAR_LOOT_PRESENCE_CHANCE = 0.35;
/** Carros — centro da cidade. */
export const CAR_LOOT_PRESENCE_CHANCE_CENTER = 0.5;
/** Multiplicador do raio do pulso Space (sentido de sobrevivência). */
export const SURVIVAL_SENSE_RADIUS_MULT = 1.5;
/** Tempo a vasculhar (ms). */
export const LOOT_SEARCH_MS = 5_000;
/** Raio para interagir / resolver presença. */
export const LOOT_REVEAL_RADIUS = 32;
/** Duração dos marcadores revelados pelo pulso (ms). */
export const SURVIVAL_SENSE_REVEAL_MS = 20_000;
/** Cooldown do sentido de sobrevivência (ms). */
export const SURVIVAL_SENSE_COOLDOWN_MS = 2 * 60 * 1000;

export interface LootSite {
  id: string;
  /** Id do POI de exploração (cidade). */
  poiId: string;
  /** Tipo do POI / prop (ex.: abandoned_car, wrecked_car). */
  typeId: string;
  x: number;
  y: number;
  luck: number;
  /** null = ainda não aproximou; true/false após roll de presença. */
  hasLoot: boolean | null;
  /** Vasculhadas concluídas neste POI (Mais uma vez! permite 2). */
  searchesDone: number;
  /** Esgotado — sem mais vasculhadas. */
  depleted: boolean;
  /** Destacado pelo pulso Space. */
  pulseRevealUntil: number;
}

export interface PendingLootItem {
  uid: string;
  itemId: ItemId;
  qty: number;
  roll: number;
  rarity: LootRollResult['rarity'];
  label: string;
}

export type SearchFinishResult =
  | { status: 'empty' }
  | { status: 'found'; roll: number; items: PendingLootItem[] }
  | { status: 'cancelled' }
  | { status: 'none' };

/**
 * Exploração nos POIs (bolinhas) + inventário.
 */
export class ResourceManager {
  private sites: LootSite[] = [];
  readonly inventory = new Inventory();
  readonly loadout = new EquipmentLoadout();
  readonly survival = new SurvivalState();
  private searchSiteId: string | null = null;
  private searchElapsed = 0;
  private uidSeq = 0;
  /** Tempo de jogo até poder usar o sentido de novo (ms acumulados). */
  private senseReadyAt = 0;
  private gameTime = 0;

  get all(): readonly LootSite[] {
    return this.sites;
  }

  get isSearching(): boolean {
    return this.searchSiteId != null;
  }

  get searchProgress01(): number {
    if (!this.searchSiteId) return 0;
    return Math.min(1, this.searchElapsed / LOOT_SEARCH_MS);
  }

  get searchingSiteId(): string | null {
    return this.searchSiteId;
  }

  /** 0 = pronto, 1 = acabou de usar. */
  get survivalSenseCooldown01(): number {
    if (this.gameTime >= this.senseReadyAt) return 0;
    const left = this.senseReadyAt - this.gameTime;
    return Math.min(1, left / SURVIVAL_SENSE_COOLDOWN_MS);
  }

  get survivalSenseReady(): boolean {
    return this.gameTime >= this.senseReadyAt;
  }

  spawnForCity(
    _scene: Phaser.Scene,
    city: City,
    _collision: WorldCollision,
  ): void {
    this.clearSites();
    this.inventory.clear();
    this.loadout.reset();
    this.survival.reset();
    this.loadout.equipStarterWeapons();
    syncInventoryCapacity(this.inventory, this.loadout);
    this.searchSiteId = null;
    this.searchElapsed = 0;
    this.senseReadyAt = 0;
    this.gameTime = 0;

    const ts = city.tileSize;
    const cx = city.center.x;
    const cy = city.center.y;

    for (const poi of city.explorationPoints) {
      const px = poi.x * ts + ts / 2;
      const py = poi.y * ts + ts / 2;
      const distN = centerDistanceNorm(
        poi.x,
        poi.y,
        cx,
        cy,
        city.grid.w,
        city.grid.h,
      );
      this.sites.push({
        id: `loot-${poi.id}`,
        poiId: poi.id,
        typeId: poi.typeId,
        x: px,
        y: py,
        luck: proximityFromCenter(distN),
        hasLoot: null,
        searchesDone: 0,
        depleted: false,
        pulseRevealUntil: 0,
      });
    }

    for (const prop of city.ambientProps) {
      if (prop.kind !== 'wrecked_car') continue;
      const px = prop.x * ts + ts / 2;
      const py = prop.y * ts + ts / 2;
      const distN = centerDistanceNorm(
        prop.x,
        prop.y,
        cx,
        cy,
        city.grid.w,
        city.grid.h,
      );
      this.sites.push({
        id: `loot-${prop.id}`,
        poiId: prop.id,
        typeId: 'wrecked_car',
        x: px,
        y: py,
        luck: proximityFromCenter(distN),
        hasLoot: null,
        searchesDone: 0,
        depleted: false,
        pulseRevealUntil: 0,
      });
    }
  }

  update(deltaMs: number): void {
    this.gameTime += deltaMs;
  }

  /** Cadáver de zumbi derrotado — lootável como POI comum (chance regional). */
  registerZombieCorpseLootSite(
    corpseId: string,
    x: number,
    y: number,
    luck: number,
  ): LootSite {
    const site: LootSite = {
      id: `loot-${corpseId}`,
      poiId: corpseId,
      typeId: ZOMBIE_CORPSE_POI_TYPE_ID,
      x,
      y,
      luck,
      hasLoot: null,
      searchesDone: 0,
      depleted: false,
      pulseRevealUntil: 0,
    };
    this.sites.push(site);
    return site;
  }

  /**
   * Resolve 50% ao entrar no raio pela 1ª vez.
   * @returns 'has' | 'empty' | 'already' | null (fora de alcance / deplete)
   */
  probeNearest(
    playerX: number,
    playerY: number,
    radius = LOOT_REVEAL_RADIUS,
    rng = Math.random,
  ): { site: LootSite; result: 'has' | 'empty' | 'known' } | null {
    const site = this.nearestInteractable(playerX, playerY, radius);
    if (!site) return null;
    if (site.hasLoot !== null) {
      return { site, result: 'known' };
    }
    site.hasLoot = rng() < lootPresenceChance(site.typeId, site.luck);
    return { site, result: site.hasLoot ? 'has' : 'empty' };
  }

  nearestInteractable(
    playerX: number,
    playerY: number,
    radius = LOOT_REVEAL_RADIUS,
  ): LootSite | null {
    let best: LootSite | null = null;
    let bestD = radius;
    for (const s of this.sites) {
      if (s.depleted) continue;
      const d = Math.hypot(s.x - playerX, s.y - playerY);
      if (d <= bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Site com loot confirmado e ainda não deplete, no raio (para lupa). */
  nearestSearchable(
    playerX: number,
    playerY: number,
    radius = LOOT_REVEAL_RADIUS,
  ): LootSite | null {
    const s = this.nearestInteractable(playerX, playerY, radius);
    if (!s || s.hasLoot !== true) return null;
    return s;
  }

  beginSearch(siteId: string): boolean {
    const site = this.sites.find((s) => s.id === siteId);
    if (!site || site.depleted || site.hasLoot !== true) return false;
    if (this.searchSiteId === siteId) return true;
    this.searchSiteId = siteId;
    this.searchElapsed = 0;
    return true;
  }

  cancelSearch(): void {
    this.searchSiteId = null;
    this.searchElapsed = 0;
  }

  /**
   * Avança o canal de busca. Se o jogador sair do raio, cancela.
   */
  tickSearch(
    deltaMs: number,
    playerX: number,
    playerY: number,
    intellectScore = 10,
    lootTalents?: LootTalentMods,
    maxSearchesPerSite = 1,
    rng = Math.random,
  ): SearchFinishResult | null {
    if (!this.searchSiteId) return null;
    const site = this.sites.find((s) => s.id === this.searchSiteId);
    if (!site || site.depleted) {
      this.cancelSearch();
      return { status: 'none' };
    }
    if (Math.hypot(site.x - playerX, site.y - playerY) > LOOT_REVEAL_RADIUS * 1.15) {
      this.cancelSearch();
      return { status: 'cancelled' };
    }

    this.searchElapsed += deltaMs;
    if (this.searchElapsed < LOOT_SEARCH_MS) return null;

    this.searchSiteId = null;
    this.searchElapsed = 0;

    const rolls = rollLootWithIntellect(
      intellectScore,
      rng,
      lootTalents,
      Math.floor(site.luck * 3),
      site.typeId,
    );
    const primary = rolls[0]!;
    const items: PendingLootItem[] = rolls.map((loot) => ({
      uid: `p${(this.uidSeq += 1)}`,
      itemId: loot.itemId,
      qty: 1,
      roll: loot.total,
      rarity: loot.rarity,
      label: loot.label,
    }));

    site.searchesDone += 1;
    if (site.searchesDone >= maxSearchesPerSite) {
      site.depleted = true;
      site.hasLoot = false;
    }

    return { status: 'found', roll: primary.total, items };
  }

  markDepleted(siteId: string): void {
    const s = this.sites.find((x) => x.id === siteId);
    if (s) {
      s.depleted = true;
      s.hasLoot = false;
    }
  }

  /**
   * Pulso: revela sites com loot (já resolvidos ou pré-rola 50% nos que estão no raio).
   * @returns sites destacados neste pulso
   */
  trySurvivalSense(
    playerX: number,
    playerY: number,
    visionRadiusPx: number,
    rng = Math.random,
  ): LootSite[] | null {
    if (!this.survivalSenseReady) return null;
    this.senseReadyAt = this.gameTime + SURVIVAL_SENSE_COOLDOWN_MS;
    const until = this.gameTime + SURVIVAL_SENSE_REVEAL_MS;
    const found: LootSite[] = [];
    const senseRadiusPx = visionRadiusPx * SURVIVAL_SENSE_RADIUS_MULT;

    for (const s of this.sites) {
      if (s.depleted) continue;
      const d = Math.hypot(s.x - playerX, s.y - playerY);
      if (d > senseRadiusPx) continue;
      if (s.hasLoot === null) {
        s.hasLoot = rng() < lootPresenceChance(s.typeId, s.luck);
      }
      if (s.hasLoot === true) {
        s.pulseRevealUntil = until;
        found.push(s);
      }
    }
    return found;
  }

  /** Sites actualmente destacados pelo pulso. */
  pulseVisibleSites(): LootSite[] {
    return this.sites.filter(
      (s) =>
        !s.depleted &&
        s.hasLoot === true &&
        s.pulseRevealUntil > this.gameTime,
    );
  }

  clear(): void {
    this.clearSites();
    this.inventory.clear();
    this.loadout.reset();
    this.survival.reset();
    this.loadout.equipStarterWeapons();
    syncInventoryCapacity(this.inventory, this.loadout);
    this.cancelSearch();
    this.senseReadyAt = 0;
    this.gameTime = 0;
  }

  private clearSites(): void {
    this.sites = [];
  }

  /** @deprecated */
  tryPickup(): number {
    return 0;
  }

  getInventory() {
    return this.inventory;
  }
}

/** Chance 0–1 de o site ter loot, interpolada rural → centro. */
export function lootPresenceChance(typeId: string, proximity = 0): number {
  const t = Math.max(0, Math.min(1, proximity));
  const isCar =
    typeId === 'wrecked_car' || CAR_POI_TYPE_IDS.has(typeId);
  if (isCar) {
    return lerp(CAR_LOOT_PRESENCE_CHANCE, CAR_LOOT_PRESENCE_CHANCE_CENTER, t);
  }
  return lerp(LOOT_PRESENCE_CHANCE, LOOT_PRESENCE_CHANCE_CENTER, t);
}
