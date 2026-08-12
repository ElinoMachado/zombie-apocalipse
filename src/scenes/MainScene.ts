import Phaser from 'phaser';
import { preloadTilesheets } from '../assets/manifest';
import { GameAudio, preloadAudio } from '../audio/GameAudio';
import { CombatSystem } from '../game/combat/CombatSystem';
import { DamageNumbers } from '../game/combat/DamageNumbers';
import { EnemyManager } from '../game/combat/EnemyManager';
import { ZombieVisionOverlay } from '../game/combat/ZombieVisionOverlay';
import { DayNightCycle, DAY_VISION_TILES, visionOuterTiles } from '../game/DayNightCycle';
import {
  cameraSafeMarginTiles,
} from '../game/findHighwaySpawn';
import { findSafePlayerSpawn } from '../game/findSafeSpawn';
import { FireHazards } from '../game/FireHazards';
import { Player } from '../game/Player';
import { ResourceManager } from '../game/resources/ResourceManager';
import { WorldCollision } from '../game/WorldCollision';
import { VisionWorldRenderer } from '../render/VisionWorldRenderer';
import { GenerateCityButton } from '../ui/GenerateCityButton';
import { MainMenuHud } from '../ui/MainMenuHud';
import { SpriteTuningHud } from '../ui/SpriteTuningHud';
import { MapLegend } from '../ui/MapLegend';
import { DayNightClockHud } from '../ui/DayNightClockHud';
import { DiceRollHud } from '../ui/DiceRollHud';
import { InventoryHud } from '../ui/InventoryHud';
import { CharacterSheetHud } from '../ui/CharacterSheetHud';
import { LootResultPopup } from '../ui/LootResultPopup';
import { LootSearchHud } from '../ui/LootSearchHud';
import { SurvivalSenseHud } from '../ui/SurvivalSenseHud';
import { LootSenseOverlay } from '../ui/LootSenseOverlay';
import { WeaponHud } from '../ui/WeaponHud';
import type { WeaponQuickSlotId } from '../ui/WeaponHud';
import { GameChatHud } from '../ui/GameChatHud';
import {
  createHitboxDebugState,
  parseChatCommand,
  type HitboxDebugState,
} from '../game/debug/chatCommands';
import { CarHitboxOverlay } from '../render/CarHitboxOverlay';
import { isDevMode } from '../game/dev/isDevMode';
import { getDefaultProfileId, listProfiles } from '../world/profiles';
import {
  formatWorldSummary,
  generateWorld,
  getPrimaryCity,
} from '../world';
import type { City, CitySizeClass, World } from '../world/model/types';
import type { ItemId } from '../game/inventory/inventory';
import type { EquipSlotId } from '../game/inventory/equipmentLoadout';
import {
  quickActionFromInventory,
  syncCombatWeapons,
  syncInventoryCapacity,
  unequipToInventory,
  unequipWeaponToInventory,
} from '../game/inventory/itemActions';
import type { AttributeId } from '../game/progression/attributes';
import type { XpSource } from '../game/progression/PlayerProgression';
import type { TalentId } from '../game/progression/talents';
import { talentEffectsFor } from '../game/progression/talentEffects';

type PlayKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  C: Phaser.Input.Keyboard.Key;
  SHIFT: Phaser.Input.Keyboard.Key;
  SPACE: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
  BRACKET_OPEN: Phaser.Input.Keyboard.Key;
  BRACKET_CLOSE: Phaser.Input.Keyboard.Key;
  ZERO: Phaser.Input.Keyboard.Key;
  I: Phaser.Input.Keyboard.Key;
  ENTER: Phaser.Input.Keyboard.Key;
};

/** Zoom com visão diurna padrão; sobe/desce com o raio de visão. */
const PLAY_ZOOM_AT_DAY = 3.5;
const PLAY_ZOOM_MIN = 1.35;
const PLAY_ZOOM_MAX = 4.8;

/** Maior visão → câmara mais afastada (mais área à volta). */
function playZoomForVision(visionClearTiles: number): number {
  const outer = visionOuterTiles(Math.max(1, visionClearTiles));
  const refOuter = visionOuterTiles(DAY_VISION_TILES);
  return Phaser.Math.Clamp(
    PLAY_ZOOM_AT_DAY * (refOuter / outer),
    PLAY_ZOOM_MIN,
    PLAY_ZOOM_MAX,
  );
}

/**
 * Fluxo:
 * - Gerar cidade → spawn + névoa + streaming + ambientação
 * - WASD; C stealth; Shift correr; LMB pistola; RMB faca
 * - Espaço: sentido de sobrevivência; lupa: vasculhar POIs
 * - ESC termina e mostra UI
 */
export class MainScene extends Phaser.Scene {
  private worldRenderer!: VisionWorldRenderer;
  private mainMenu!: MainMenuHud;
  private ui!: GenerateCityButton;
  private spriteTuning: SpriteTuningHud | null = null;
  private legend!: MapLegend;
  private weaponHud!: WeaponHud;
  private lootSenseOverlay!: LootSenseOverlay;
  private inventoryHud!: InventoryHud;
  private characterSheet!: CharacterSheetHud;
  private lootSearchHud!: LootSearchHud;
  private lootPopup!: LootResultPopup;
  private survivalHud!: SurvivalSenseHud;
  private dayNightHud!: DayNightClockHud;
  private diceHud!: DiceRollHud;
  private audio!: GameAudio;
  private world: World | null = null;
  private city: City | null = null;
  private player: Player | null = null;
  private combat: CombatSystem | null = null;
  private floaters: DamageNumbers | null = null;
  private enemies = new EnemyManager();
  private zombieVision: ZombieVisionOverlay | null = null;
  private resources = new ResourceManager();
  private fires = new FireHazards();
  private playing = false;
  /** World Generator — mapa visível sem spawn/jogabilidade. */
  private previewing = false;
  private blockCombatInput = false;
  /** LMB/RMB pressionados em cima de UI HTML. */
  private uiPointerCapturesCombat = false;
  private uiCombatBlockUntil = 0;
  private readonly onUiPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0 && ev.button !== 2) return;
    if (!this.isInteractiveUiTarget(ev.target)) return;
    this.uiPointerCapturesCombat = true;
  };
  private readonly onUiPointerUp = (): void => {
    if (!this.uiPointerCapturesCombat) return;
    this.uiPointerCapturesCombat = false;
    this.uiCombatBlockUntil = this.time.now + 250;
  };
  private characterSheetOpen = false;
  private levelUpToastUntil = 0;
  private itemToastUntil = 0;
  private itemToastText = '';
  private activeLootSiteId: string | null = null;
  private lootSearchAudioActive = false;
  private emptyToastUntil = 0;
  private pulseGfx: Phaser.GameObjects.Graphics | null = null;
  private pulseAgeMs = -1;
  private pulseMaxR = 0;
  private senseMarkers: Phaser.GameObjects.Graphics | null = null;
  private keys!: PlayKeys;
  private worldPixel = { width: 0, height: 0 };
  private dayNight = new DayNightCycle();
  private hud!: Phaser.GameObjects.Text;
  private collision = new WorldCollision();
  private chat!: GameChatHud;
  private hitboxDebug!: HitboxDebugState;
  private carHitboxOverlay: CarHitboxOverlay | null = null;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    preloadTilesheets(this);
    preloadAudio(this);
  }

  create(): void {
    this.worldRenderer = new VisionWorldRenderer(this);
    this.audio = new GameAudio(this);
    this.cameras.main.setBackgroundColor(0x1a2e1c);

    const kb = this.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      C: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      SHIFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ESC: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      BRACKET_OPEN: kb.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET),
      BRACKET_CLOSE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET),
      ZERO: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO),
      I: kb.addKey(Phaser.Input.Keyboard.KeyCodes.I),
      ENTER: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    };

    this.ui = new GenerateCityButton({
      onGenerate: (sizeClass, profileId) =>
        this.generateMapPreview(sizeClass, profileId),
      onBack: () => this.endPreview(),
    });
    this.ui.hide();

    this.mainMenu = new MainMenuHud(
      {
        onPlay: () => this.playFromMenu(),
        onWorldGenerator: isDevMode() ? () => this.showWorldGenerator() : undefined,
        onSprites: isDevMode() ? () => this.showSpriteTuning() : undefined,
      },
      isDevMode(),
    );
    this.mainMenu.show();
    this.legend = new MapLegend();
    this.weaponHud = new WeaponHud();
    this.lootSenseOverlay = new LootSenseOverlay();
    this.inventoryHud = new InventoryHud();
    this.characterSheet = new CharacterSheetHud();
    this.lootSearchHud = new LootSearchHud();
    this.lootPopup = new LootResultPopup();
    this.survivalHud = new SurvivalSenseHud();
    this.dayNightHud = new DayNightClockHud();
    this.diceHud = new DiceRollHud();
    this.wireLootUi();
    this.wireCharacterSheet();
    this.wireUiCombatBlock();
    this.hitboxDebug = createHitboxDebugState();
    this.chat = new GameChatHud();
    this.chat.setCanOpen(() => this.playing);
    this.chat.setSubmitHandler((text) => this.handleChatSubmit(text));

    this.hud = this.add
      .text(12, 12, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#e6edf3',
        backgroundColor: '#0d1117aa',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(80)
      .setVisible(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cameras.main.off(
        Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE,
        this.snapCameraToScreenPixels,
        this,
      );
      this.endSession(false);
      this.unwireUiCombatBlock();
      this.spriteTuning?.destroy();
      this.spriteTuning = null;
      this.mainMenu.destroy();
      this.ui.destroy();
      this.legend.destroy();
      this.weaponHud.destroy();
      this.inventoryHud.destroy();
      this.characterSheet.destroy();
      this.lootSearchHud.destroy();
      this.lootPopup.destroy();
      this.survivalHud.destroy();
      this.dayNightHud.destroy();
      this.diceHud.destroy();
      this.chat.destroy();
      this.carHitboxOverlay?.destroy();
      this.carHitboxOverlay = null;
      this.pulseGfx?.destroy();
      this.senseMarkers?.destroy();
      this.audio.destroy();
      this.worldRenderer.destroy();
      this.hud.destroy();
    });

    // Depois do follow: alinha scroll a pixels do ecrã (fecha costuras do tilemap).
    this.cameras.main.on(
      Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE,
      this.snapCameraToScreenPixels,
      this,
    );
  }

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      if (this.chat.isOpen()) {
        this.chat.close();
        return;
      }
      if (this.characterSheetOpen) {
        this.characterSheet.closeSheet();
        this.characterSheetOpen = false;
        this.blockCombatInput = false;
        return;
      }
      if (this.previewing) {
        this.endPreview();
        return;
      }
      if (this.playing) this.endSession(true);
      return;
    }

    if (this.previewing) {
      this.updateMapPreview(delta);
      return;
    }

    if (!this.playing || !this.player || !this.city || !this.combat || !this.floaters) {
      return;
    }

    let chatOpen = this.chat.isOpen();

    if (
      !chatOpen &&
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    ) {
      this.openChat();
      chatOpen = this.chat.isOpen();
    }

    if (!chatOpen && Phaser.Input.Keyboard.JustDown(this.keys.I)) {
      this.toggleCharacterSheet();
    }

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const aimAngle = Math.atan2(
      worldPoint.y - this.player.y,
      worldPoint.x - this.player.x,
    );

    const lootLocked = this.resources.isSearching;
    const movementLocked = lootLocked || chatOpen;

    const moved = this.player.update(
      delta,
      this.keys,
      this.worldPixel.width,
      this.worldPixel.height,
      this.collision,
      aimAngle,
      movementLocked,
    );
    // Stealth: sem SFX de passos. Vasculhando: imóvel.
    if (!this.player.isStealth && !lootLocked) this.audio.onMove(moved);
    this.audio.updateListener(this.player.x, this.player.y);

    this.syncLootSearchPrompt(delta);
    this.resources.update(delta);
    if (this.player) {
      const p = this.player;
      this.resources.survival.update(delta, {
        alive: p.alive,
        hp: p.hp,
        maxHp: p.maxHp,
        heal: (n) => p.heal(n),
        takeDamage: (n) => {
          const d = p.takeDamage(n);
          if (d > 0) this.floaters?.showIncoming(p.x, p.y, d);
          return d;
        },
        stamina: p.stamina,
        maxStamina: p.maxStamina,
      });
      p.recalcFromTalents(false);
    }
    this.tickSurvivalPulse(delta);
    this.drawSenseMarkers();

    if (!chatOpen && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.trySurvivalSense();
    }

    if (this.fires.touches(this.player.x, this.player.y, this.player.radius)) {
      this.player.ignite(3);
    }
    const burnDmg = this.player.updateBurn(delta);
    if (burnDmg > 0) {
      this.floaters.showIncoming(this.player.x, this.player.y, burnDmg);
    }

    this.player.faceAim(aimAngle);
    const allowCombat =
      this.player.alive &&
      !this.blockCombatInput &&
      !this.uiPointerCapturesCombat &&
      this.time.now >= this.uiCombatBlockUntil &&
      !this.lootPopup.isOpen &&
      !this.characterSheetOpen &&
      !this.chat.isOpen();
    this.combat.update(
      delta,
      this.player.x,
      this.player.y,
      aimAngle,
      pointer,
      allowCombat,
    );

    this.enemies.updateAI(
      delta,
      this.player.x,
      this.player.y,
      this.player.radius,
      this.worldPixel.width,
      this.worldPixel.height,
      this.collision,
      (damage, atX, atY) => {
        if (!this.player?.alive) return;
        const applied = this.player.takeDamage(damage);
        if (applied > 0) this.floaters?.showIncoming(atX, atY, applied);
      },
      this.player.isStealth,
      this.audio.zombieVocals,
    );

    this.zombieVision?.sync(
      this.enemies.all,
      this.player.x,
      this.player.y,
      this.player.isStealth,
      this.collision,
    );

    this.floaters.update(delta);
    this.syncProgressionHud();
    this.inventoryHud.sync(this.resources.inventory);
    this.survivalHud.sync(this.resources.survivalSenseCooldown01);

    this.dayNight.update(delta);
    this.dayNightHud.sync(this.dayNight.isDay, this.dayNight.halfPhase01);

    if (Phaser.Input.Keyboard.JustDown(this.keys.BRACKET_OPEN)) {
      this.dayNight.adjustVision(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.BRACKET_CLOSE)) {
      this.dayNight.adjustVision(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ZERO)) {
      this.dayNight.clearVisionOverride();
    }

    const vision = this.effectiveVisionTiles();
    this.syncCameraZoomToVision(vision);
    this.worldRenderer.syncFrame(
      this.player.x,
      this.player.y,
      vision,
      !this.dayNight.isDay,
    );
    this.worldRenderer.updateFx(time);

    const mode = this.dayNight.hasManualVision ? 'manual' : 'auto';
    const huntN = this.enemies.huntingCount;
    const horde = this.enemies.hordeActive ? ' · HORDA!' : '';
    const stance = this.player.isStealth
      ? ' · STEALTH'
      : this.player.sprinting
        ? ' · SPRINT'
        : '';
    const emptyHint =
      this.time.now < this.emptyToastUntil ? ' · Nada útil…' : '';
    const levelHint =
      this.time.now < this.levelUpToastUntil ? ' · SUBIU DE NÍVEL!' : '';
    const itemHint =
      this.time.now < this.itemToastUntil ? ` · ${this.itemToastText}` : '';
    this.syncCarHitboxOverlay();
    this.hud.setText(
      `${this.dayNight.label} · visão ${vision} (${mode})${stance}${
        huntN > 0 ? ` · caça ${huntN}` : ''
      }${horde}${emptyHint}${levelHint}${itemHint}${
        chatOpen ? ' · CHAT ABERTO (Esc fecha)' : ''
      } · Enter chat · I ficha · ESC`,
    );
  }

  private handleChatSubmit(text: string): void {
    const res = parseChatCommand(text, this.hitboxDebug);
    this.chat.appendLine(res.message, res.error ? 'error' : 'system');
    this.syncCarHitboxOverlay();
  }

  private openChat(): void {
    if (!this.playing || this.chat.isOpen()) return;
    this.chat.open();
    this.keys.ENTER.reset();
  }

  private syncCarHitboxOverlay(): void {
    if (!this.carHitboxOverlay) return;
    const on = this.hitboxDebug.showCarHitboxes;
    this.carHitboxOverlay.setVisible(on);
    if (on) this.carHitboxOverlay.sync(this.collision.carHitboxes);
  }

  private startGame(sizeClass: CitySizeClass, profileId: string): void {
    this.mainMenu.hide();
    this.ui.hide();
    this.endSession(false);

    const built = this.buildWorld(sizeClass, profileId);
    if (!built) {
      this.showMainMenu();
      return;
    }
    const { city, dump, primaries, secondaries } = built;

    this.collision.rebuild(city);
    this.worldRenderer.setFogOverlayVisible(true);
    if (!this.carHitboxOverlay) {
      this.carHitboxOverlay = new CarHitboxOverlay(this);
    }
    this.syncCarHitboxOverlay();
    this.dayNight.reset();

    const ts = city.tileSize;
    const startZoom = playZoomForVision(this.effectiveVisionTiles());
    const margins = cameraSafeMarginTiles(
      this.scale.width,
      this.scale.height,
      startZoom,
      ts,
    );
    const playerRadius = 6;
    const safeSpawn = findSafePlayerSpawn(
      city,
      this.collision,
      this.worldPixel.width,
      this.worldPixel.height,
      playerRadius,
      { ruralEdgeBandFraction: 0.12, ...margins },
    );
    const sx = safeSpawn.x;
    const sy = safeSpawn.y;

    this.player = new Player(this, sx, sy);
    this.floaters = new DamageNumbers(this);
    this.zombieVision = new ZombieVisionOverlay(this);
    this.combat = new CombatSystem(
      this,
      this.enemies,
      this.collision,
      this.floaters,
      this.audio,
      (noise, px, py) => {
        this.diceHud.play(noise);
        if (!this.city) return;
        if (noise.elite) {
          const visionOuterPx =
            this.dayNight.visionOuterTiles * this.city.tileSize;
          this.enemies.spawnFromNoise(
            this,
            this.city,
            this.collision,
            px,
            py,
            1,
            true,
            visionOuterPx,
          );
        } else if (noise.noiseHeard) {
          this.enemies.alertNearestFromNoise(px, py);
        }
      },
    );
    this.combat.setAttributeProvider(
      () => this.player!.progression.attributes,
    );
    this.combat.setTalentProvider(
      () => talentEffectsFor(this.player!.progression),
      () => this.player!.isStealth,
    );
    this.combat.setKillHandler((enemy) => {
      this.audio.zombieVocals.release(enemy.id);
      this.handleXp('kill_zombie');
    });
    this.enemies.spawnForCity(this, city, this.collision, sx, sy, this.audio.zombieVocals);
    this.resources.spawnForCity(this, city, this.collision);
    this.wireItemMechanics();
    this.fires.setFromCity(city.ambientProps, ts);

    const cam = this.cameras.main;
    cam.setZoom(startZoom);
    // roundPixels:false — com zoom fraccionário o snap a px inteiros faz o movimento tremer.
    cam.setRoundPixels(false);
    this.applyPlayCameraBounds();
    cam.startFollow(this.player.sprite, false, 0.22, 0.22);
    cam.setFollowOffset(0, 0);
    cam.centerOn(sx, sy);

    const vision = this.effectiveVisionTiles();
    this.worldRenderer.syncFrame(sx, sy, vision, !this.dayNight.isDay);
    this.audio.bindWorldEmitters(city);
    this.audio.startMusic();

    this.playing = true;
    this.chat.showLauncher();
    this.ui.hide();
    this.legend.show();
    this.weaponHud.show();
    this.inventoryHud.show();
    this.inventoryHud.sync(this.resources.inventory);
    this.survivalHud.show();
    this.survivalHud.sync(0);
    this.wireLootUi();
    this.wireCharacterSheet();
    this.dayNightHud.show();
    this.dayNightHud.sync(this.dayNight.isDay, this.dayNight.halfPhase01);
    this.syncProgressionHud();
    this.hud.setVisible(true);

    this.ui.updateInfo({
      name: city.name,
      seed: this.world!.seed,
      sizeClass: city.sizeClass,
      profileId: city.profileId,
      primaries,
      secondaries,
      pois: city.explorationPoints.length,
      dump,
    });
  }

  /** World Generator — só gera e mostra o mapa (sem jogar). */
  private generateMapPreview(
    sizeClass: CitySizeClass,
    profileId: string,
  ): void {
    this.endSession(false);
    this.previewing = true;
    this.mainMenu.hide();

    const built = this.buildWorld(sizeClass, profileId);
    if (!built) {
      this.previewing = false;
      this.ui.show();
      this.showMainMenu();
      return;
    }

    const { city, dump, primaries, secondaries } = built;
    this.worldRenderer.setFogOverlayVisible(false);

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setRoundPixels(false);
    this.applyPreviewCamera(city);

    this.worldRenderer.syncPreviewFrame();
    this.legend.show();

    this.ui.show();
    this.ui.updateInfo({
      name: city.name,
      seed: this.world!.seed,
      sizeClass: city.sizeClass,
      profileId: city.profileId,
      primaries,
      secondaries,
      pois: city.explorationPoints.length,
      dump,
    });
    this.ui.setHint(
      'Mapa gerado — WASD move a câmara · ESC ou Voltar ao menu',
    );
  }

  private buildWorld(
    sizeClass: CitySizeClass,
    profileId: string,
  ): {
    city: City;
    dump: string;
    primaries: number;
    secondaries: number;
  } | null {
    this.world = generateWorld({ seed: Date.now(), sizeClass, profileId });
    const city = getPrimaryCity(this.world);
    if (!city) return null;
    this.city = city;

    const dump = formatWorldSummary(this.world);
    console.log(dump);

    this.worldPixel = this.worldRenderer.getPixelSize(city);
    this.worldRenderer.bind(city);

    let primaries = 0;
    let secondaries = 0;
    for (const s of city.structures) {
      if (s.category === 'primary') primaries += 1;
      else if (s.category === 'secondary') secondaries += 1;
    }

    return { city, dump, primaries, secondaries };
  }

  private applyPreviewCamera(city: City): void {
    const cam = this.cameras.main;
    const w = this.worldPixel.width;
    const h = this.worldPixel.height;
    cam.setBounds(0, 0, w, h);
    const fitZoom =
      Math.min(this.scale.width / w, this.scale.height / h) * 0.92;
    cam.setZoom(Phaser.Math.Clamp(fitZoom, 0.35, PLAY_ZOOM_MAX));
    cam.centerOn(w / 2, h / 2);
  }

  private updateMapPreview(delta: number): void {
    if (!this.previewing || !this.city) return;

    const cam = this.cameras.main;
    const speed = 420 / cam.zoom;
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy -= 1;
    if (this.keys.S.isDown) dy += 1;
    if (this.keys.A.isDown) dx -= 1;
    if (this.keys.D.isDown) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      cam.scrollX += (dx / len) * speed * dt;
      cam.scrollY += (dy / len) * speed * dt;
    }

    this.worldRenderer.syncPreviewFrame();
    this.worldRenderer.updateFx(this.time.now);
  }

  private endPreview(): void {
    if (!this.previewing) {
      this.showMainMenu();
      return;
    }
    this.endSession(true);
  }

  private wireCharacterSheet(): void {
    this.characterSheet.setHandlers(
      () => {
        this.characterSheetOpen = false;
        this.blockCombatInput = false;
      },
      (id) => this.spendAttributePoint(id),
      (id) => this.spendTalentPoint(id),
      (slotIndex) => this.onInventoryItemAction(slotIndex),
      (equipSlot) => this.onUnequipSlot(equipSlot),
    );
  }

  private wireItemMechanics(): void {
    if (!this.player || !this.combat) return;
    this.player.setSurvival(this.resources.survival);
    this.player.setEquipStatsProvider(() =>
      this.resources.loadout.aggregateStats(),
    );
    this.combat.setAttackPenaltyProvider(() => this.player!.combatPenalty());
    syncCombatWeapons(this.resources.loadout, this.combat);
    syncInventoryCapacity(this.resources.inventory, this.resources.loadout);
    this.weaponHud.setQuickUnequipHandler((slot) =>
      this.onUnequipQuickSlot(slot),
    );
    this.inventoryHud.setItemActionHandler((slotIndex) =>
      this.onInventoryItemAction(slotIndex),
    );
  }

  private afterItemAction(result: {
    ok: boolean;
    message: string;
  }): boolean {
    if (!result.ok) {
      this.showItemToast(result.message);
      return false;
    }
    syncInventoryCapacity(this.resources.inventory, this.resources.loadout);
    this.showItemToast(result.message);
    this.inventoryHud.sync(this.resources.inventory);
    this.syncProgressionHud();
    if (this.characterSheetOpen) this.syncCharacterSheet();
    return true;
  }

  private onUnequipQuickSlot(slot: WeaponQuickSlotId): boolean {
    if (!this.player) return false;
    return this.afterItemAction(
      unequipWeaponToInventory(
        this.resources.loadout,
        slot,
        this.resources.inventory,
        this.itemActionTarget(),
        this.combat,
      ),
    );
  }

  private itemActionTarget() {
    const p = this.player!;
    return {
      heal: (n: number) => p.heal(n),
      maxHp: p.maxHp,
      hp: p.hp,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      addStamina: (n: number) => p.addStamina(n),
      recalcStats: () => p.recalcFromTalents(false),
    };
  }

  private showItemToast(message: string): void {
    this.itemToastText = message;
    this.itemToastUntil = this.time.now + 2800;
  }

  private onInventoryItemAction(slotIndex: number): boolean {
    if (!this.player) return false;
    return this.afterItemAction(
      quickActionFromInventory(
        this.resources.inventory,
        slotIndex,
        this.resources.loadout,
        this.resources.survival,
        this.itemActionTarget(),
        this.combat,
      ),
    );
  }

  private onUnequipSlot(slot: EquipSlotId): boolean {
    if (!this.player) return false;
    return this.afterItemAction(
      unequipToInventory(
        this.resources.loadout,
        slot,
        this.resources.inventory,
        this.itemActionTarget(),
        this.combat,
      ),
    );
  }

  private toggleCharacterSheet(): void {
    if (this.characterSheet.isOpen()) {
      this.characterSheet.closeSheet();
      this.characterSheetOpen = false;
      this.blockCombatInput = false;
      return;
    }
    this.syncCharacterSheet();
    this.characterSheet.openSheet();
    this.characterSheetOpen = true;
    this.blockCombatInput = true;
  }

  private syncCharacterSheet(): void {
    if (!this.player) return;
    this.characterSheet.sync(
      this.player.progression,
      this.resources.inventory,
      this.resources.loadout,
      this.resources.survival,
      this.player.getEquipArmor(),
    );
  }

  private spendAttributePoint(id: AttributeId): boolean {
    if (!this.player) return false;
    const ok = this.player.progression.spendAttributePoint(id);
    if (!ok) return false;
    if (id === 'vitality') this.player.recalcFromTalents(true);
    this.syncCharacterSheet();
    this.syncProgressionHud();
    return true;
  }

  private spendTalentPoint(id: TalentId): boolean {
    if (!this.player) return false;
    const ok = this.player.progression.spendTalentPoint(id);
    if (!ok) return false;
    this.player.recalcFromTalents(true);
    this.syncCharacterSheet();
    this.syncProgressionHud();
    return true;
  }

  private handleXp(source: XpSource): void {
    if (!this.player) return;
    const ups = this.player.progression.grantXp(source);
    if (ups.length === 0) return;
    this.player.recalcFromTalents(true);
    this.syncProgressionHud();
    if (this.characterSheetOpen) this.syncCharacterSheet();
    const last = ups[ups.length - 1]!;
    const talent =
      last.talentPointsGained > 0
        ? ` +${last.talentPointsGained} talento`
        : '';
    const msg = `Nível ${last.newLevel}! +${last.attributePointsGained} atributo${talent}`;
    this.characterSheet.showLevelUpMessage(msg);
    this.levelUpToastUntil = this.time.now + 3500;
  }

  private syncProgressionHud(): void {
    if (!this.player || !this.combat) return;
    const prog = this.player.progression;
    const loadout = this.resources.loadout;
    this.weaponHud.sync(
      loadout.equippedPrimary() ? this.combat.primary : null,
      loadout.equippedSecondary() ? this.combat.secondary : null,
      this.combat.reload,
      loadout,
      this.player.hp,
      this.player.maxHp,
      this.player.stamina,
      this.player.maxStamina,
      prog.level,
      prog.xp,
      prog.xpToNextLevel(),
      prog.xpProgress01(),
    );
  }

  private wireLootUi(): void {
    this.lootSearchHud.setSearchHandler(() => this.onLootSearch());
    this.lootPopup.setHandlers(
      (_uid, itemId, qty) => this.tryTakeLootItem(itemId, qty),
      () => {
        this.blockCombatInput = false;
      },
    );
  }

  /** Impede LMB/RMB de disparar enquanto clica na UI HTML. */
  private wireUiCombatBlock(): void {
    document.addEventListener('pointerdown', this.onUiPointerDown, true);
    document.addEventListener('pointerup', this.onUiPointerUp, true);
    document.addEventListener('pointercancel', this.onUiPointerUp, true);
  }

  private unwireUiCombatBlock(): void {
    document.removeEventListener('pointerdown', this.onUiPointerDown, true);
    document.removeEventListener('pointerup', this.onUiPointerUp, true);
    document.removeEventListener('pointercancel', this.onUiPointerUp, true);
  }

  private isInteractiveUiTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;

    const chatOverlay = document.getElementById('game-chat-overlay');
    if (chatOverlay?.contains(target)) return true;

    const chatLauncher = document.getElementById('game-chat-launcher');
    if (chatLauncher?.contains(target)) return true;

    const mainMenu = document.getElementById('main-menu');
    if (mainMenu?.contains(target)) return true;

    const spriteTuning = document.getElementById('sprite-tuning');
    if (spriteTuning?.contains(target)) return true;

    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot || target === uiRoot || !uiRoot.contains(target)) return false;

    let el: HTMLElement | null =
      target instanceof HTMLElement ? target : target.parentElement;
    while (el && el !== uiRoot) {
      if (window.getComputedStyle(el).pointerEvents !== 'none') return true;
      el = el.parentElement;
    }
    return false;
  }

  private tryTakeLootItem(itemId: ItemId, qty: number): boolean {
    const r = this.resources.inventory.tryAdd(itemId, qty);
    if (!r.ok || r.added < qty) return false;
    this.inventoryHud.sync(this.resources.inventory);
    return true;
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return {
      x: (wx - cam.midPoint.x) * cam.zoom + cam.width / 2,
      y: (wy - cam.midPoint.y) * cam.zoom + cam.height / 2,
    };
  }

  private syncLootSearchPrompt(deltaMs: number): void {
    if (!this.player) {
      this.lootSearchHud.sync(null, null);
      this.activeLootSiteId = null;
      this.syncLootSearchAudio();
      return;
    }

    const probed = this.resources.probeNearest(this.player.x, this.player.y);
    if (probed?.result === 'empty') {
      this.emptyToastUntil = this.time.now + 1800;
    }

    const fx = talentEffectsFor(this.player.progression);
    const finish = this.resources.tickSearch(
      deltaMs,
      this.player.x,
      this.player.y,
      this.player.progression.attributes.intellect,
      fx.lootMods(),
      fx.maxLootSearchesPerSite(),
    );
    if (finish?.status === 'found') {
      this.syncLootSearchAudio();
      this.blockCombatInput = true;
      this.lootPopup.open(finish.roll, finish.items);
      this.handleXp('loot_search');
      this.activeLootSiteId = null;
      this.lootSearchHud.sync(null, null);
      return;
    }

    const site = this.resources.nearestSearchable(
      this.player.x,
      this.player.y,
    );
    if (!site || this.lootPopup.isOpen) {
      this.lootSearchHud.sync(null, null);
      this.activeLootSiteId = site?.id ?? null;
      this.syncLootSearchAudio();
      return;
    }
    this.activeLootSiteId = site.id;
    const screen = this.worldToScreen(site.x, site.y);
    const progress =
      this.resources.searchingSiteId === site.id
        ? this.resources.searchProgress01
        : 0;
    this.lootSearchHud.sync(screen.x, screen.y, progress);
    this.syncLootSearchAudio();
  }

  private syncLootSearchAudio(): void {
    const searching = this.resources.isSearching;
    if (searching && !this.lootSearchAudioActive) {
      this.audio.startLootSearch();
      this.lootSearchAudioActive = true;
    } else if (!searching && this.lootSearchAudioActive) {
      this.audio.stopLootSearch();
      this.lootSearchAudioActive = false;
    }
  }

  private onLootSearch(): void {
    if (!this.playing || !this.activeLootSiteId || this.lootPopup.isOpen) return;
    this.blockCombatInput = true;
    this.resources.beginSearch(this.activeLootSiteId);
    this.syncLootSearchAudio();
  }

  private trySurvivalSense(): void {
    if (!this.playing || !this.player || !this.city) return;
    const visionPx =
      this.dayNight.visionOuterTiles * this.city.tileSize * 2;
    const found = this.resources.trySurvivalSense(
      this.player.x,
      this.player.y,
      visionPx,
    );
    if (!found) return;
    this.pulseMaxR = visionPx;
    this.pulseAgeMs = 0;
    if (!this.pulseGfx) {
      this.pulseGfx = this.add.graphics().setDepth(74);
    }
  }

  private tickSurvivalPulse(deltaMs: number): void {
    if (this.pulseAgeMs < 0 || !this.pulseGfx || !this.player) return;
    this.pulseAgeMs += deltaMs;
    const dur = 650;
    const t = Math.min(1, this.pulseAgeMs / dur);
    const r = this.pulseMaxR * t;
    this.pulseGfx.clear();
    this.pulseGfx.lineStyle(2.5, 0x58a6ff, 0.85 * (1 - t));
    this.pulseGfx.strokeCircle(this.player.x, this.player.y, r);
    this.pulseGfx.fillStyle(0x58a6ff, 0.1 * (1 - t));
    this.pulseGfx.fillCircle(this.player.x, this.player.y, r);
    if (t >= 1) {
      this.pulseGfx.clear();
      this.pulseAgeMs = -1;
    }
  }

  private drawSenseMarkers(): void {
    if (!this.senseMarkers) {
      this.senseMarkers = this.add.graphics().setDepth(73);
    }
    this.senseMarkers.clear();
    if (!this.playing || !this.player || !this.city) {
      this.lootSenseOverlay.clear();
      return;
    }

    const sites = this.resources.pulseVisibleSites();
    for (const s of sites) {
      this.senseMarkers.lineStyle(2, 0x58a6ff, 0.9);
      this.senseMarkers.strokeCircle(s.x, s.y, 7);
      this.senseMarkers.fillStyle(0x58a6ff, 0.25);
      this.senseMarkers.fillCircle(s.x, s.y, 5);
    }

    this.lootSenseOverlay.sync(
      sites,
      this.player.x,
      this.player.y,
      this.cameras.main,
      this.city.tileSize,
    );
  }

  /** Raio de visão nítida incluindo bónus de talentos. */
  private effectiveVisionTiles(): number {
    const base = this.dayNight.visionTiles;
    if (!this.player) return base;
    return Math.min(
      32,
      base + talentEffectsFor(this.player.progression).visionBonusTiles(),
    );
  }

  /** Aproxima/afasta a câmara conforme o raio de visão actual. */
  private syncCameraZoomToVision(visionClearTiles: number): void {
    const cam = this.cameras.main;
    const target = playZoomForVision(visionClearTiles);
    const next = Phaser.Math.Linear(cam.zoom, target, 0.12);
    if (Math.abs(next - cam.zoom) > 0.001) {
      cam.setZoom(next);
      this.applyPlayCameraBounds();
    }
  }

  /**
   * Padding = meia viewport: a câmara continua a centrar no jogador nas
   * bordas (sem a visão “deslizar”), sem revelar mundo fora do mapa.
   */
  private applyPlayCameraBounds(): void {
    if (this.worldPixel.width <= 0 || this.worldPixel.height <= 0) return;
    const cam = this.cameras.main;
    const padX = cam.width / (2 * Math.max(0.001, cam.zoomX));
    const padY = cam.height / (2 * Math.max(0.001, cam.zoomY));
    cam.setBounds(
      -padX,
      -padY,
      this.worldPixel.width + padX * 2,
      this.worldPixel.height + padY * 2,
    );
  }

  /**
   * Com zoom fraccionário + scroll subpixel, as juntas do tilemap abrem/fecham
   * e o atlas sangra (linhas amarelas). Snap ao pixel do ecrã fecha as costuras
   * sem o salto grosseiro de roundPixels em world-space.
   * Chamado em FOLLOW_UPDATE (depois do follow, antes de desenhar objectos).
   */
  private snapCameraToScreenPixels = (): void => {
    if (!this.playing) return;
    const cam = this.cameras.main;
    const zx = cam.zoomX;
    const zy = cam.zoomY;
    if (zx <= 0 || zy <= 0) return;
    cam.scrollX = Math.round(cam.scrollX * zx) / zx;
    cam.scrollY = Math.round(cam.scrollY * zy) / zy;

    // Névoa alinhada ao scroll final (evita buraco a avançar sozinho nas bordas).
    if (this.player) {
      this.worldRenderer.syncFogOverlay(
        this.player.x,
        this.player.y,
        this.effectiveVisionTiles(),
        !this.dayNight.isDay,
      );
    }
  };

  private endSession(showUi: boolean): void {
    this.playing = false;
    this.previewing = false;
    this.chat.hideLauncher();
    this.carHitboxOverlay?.setVisible(false);
    this.audio.stopMusic();
    this.audio.clearWorldEmitters();
    this.collision.clear();
    this.combat?.destroy();
    this.combat = null;
    this.floaters?.destroy();
    this.floaters = null;
    this.zombieVision?.destroy();
    this.zombieVision = null;
    this.enemies.clear();
    this.audio.zombieVocals.clear();
    this.resources.clear();
    this.fires.clear();
    this.player?.destroy();
    this.player = null;
    this.worldRenderer.clear();
    this.world = null;
    this.city = null;
    this.hud.setVisible(false);
    this.legend.hide();
    this.weaponHud.hide();
    this.inventoryHud.hide();
    this.characterSheet.closeSheet();
    this.characterSheetOpen = false;
    this.lootSearchHud.hide();
    this.lootSearchHud.setSearchHandler(null);
    this.lootPopup.hide();
    this.survivalHud.hide();
    this.dayNightHud.hide();
    this.diceHud.hide();
    this.activeLootSiteId = null;
    this.blockCombatInput = false;
    this.uiPointerCapturesCombat = false;
    this.uiCombatBlockUntil = 0;
    this.pulseGfx?.clear();
    this.pulseAgeMs = -1;
    this.lootSenseOverlay.clear();
    this.senseMarkers?.clear();

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setScroll(0, 0);
    cam.setZoom(1);
    cam.setBounds(0, 0, this.scale.width, this.scale.height);

    if (showUi) {
      this.ui.hide();
      this.showMainMenu();
    }
  }

  private getDefaultPlayProfileId(): string {
    const preferred = 'BrazilianMediumCity';
    if (listProfiles().some((p) => p.id === preferred)) return preferred;
    return getDefaultProfileId();
  }

  private showMainMenu(): void {
    this.ui.hide();
    this.spriteTuning?.destroy();
    this.spriteTuning = null;
    this.mainMenu.show();
  }

  private playFromMenu(): void {
    this.mainMenu.hide();
    this.startGame('medium', this.getDefaultPlayProfileId());
  }

  private showWorldGenerator(): void {
    this.endSession(false);
    this.mainMenu.hide();
    this.ui.clearInfo();
    this.ui.show();
    this.ui.setHint(
      'Gera o mapa para inspecionar · WASD move a câmara · ESC volta ao menu',
    );
  }

  private showSpriteTuning(): void {
    this.mainMenu.hide();
    this.spriteTuning?.destroy();
    this.spriteTuning = new SpriteTuningHud({
      onClose: () => {
        this.spriteTuning?.destroy();
        this.spriteTuning = null;
        this.showMainMenu();
      },
    });
  }
}
