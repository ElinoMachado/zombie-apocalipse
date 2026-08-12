import Phaser from 'phaser';
import { AssetKeys, GRASS_TILE_SIZE, TILE_ATLAS_MARGIN, TILE_ATLAS_SPACING, TILE_SIZE } from '../assets/manifest';
import {
  CAR_POI_TYPE_IDS,
  pickWreckedCarFrame,
  stableCarRotation,
  wreckedCarDisplayScale,
} from '../assets/wreckedCars';
import {
  getPoiSpriteKey,
  stablePropRotation,
  worldPropDisplayScale,
} from '../assets/worldProps';
import { terrainTile } from '../assets/TilePalette';
import {
  chooseRoadTile,
  chooseSidewalkTile,
  withRoadSegmentIndex,
} from '../assets/smart';
import { getStructureDef } from '../world/catalog/structures';
import { ROAD_COLORS, ZONE_TINTS } from '../world/catalog/types';
import type { AmbientProp, City, RoadType, StructureInstance } from '../world/model/types';
import { NIGHT_VISION_TILES, visionOuterTiles } from '../game/DayNightCycle';
import { FogOfWar } from '../game/FogOfWar';
import {
  createFireFx,
  createLampFx,
  updateAmbientFx,
  type AmbientFxHandle,
} from './FireFx';

const SIDEWALK_FALLBACK = 0xc6c8cc;
const ROAD_WIDTH: Record<RoadType, number> = {
  highway: 1,
  main: 0.92,
  avenue: 0.82,
  street: 0.68,
  residential: 0.55,
};

type TerrainBucket = {
  key: string;
  map: Phaser.Tilemaps.Tilemap;
  layer: Phaser.Tilemaps.TilemapLayer;
  firstGid: number;
};

export const CHUNK_SIZE = 16;
/** Chunks extra à volta do worldView da câmara. */
const CAMERA_CHUNK_PADDING = 1;
/** Máx. chunks novos materializados por frame (anti-spike). */
const MAX_CHUNKS_PER_FRAME = 3;
/** Máx. células de tile por frame. */
const MAX_CELLS_PER_FRAME = 192;

/**
 * - Streaming: só materializa tiles/props no frustum da câmara (estado preservado).
 * - Névoa: overlay de neblina no ecrã + círculo suave de visão no jogador.
 */
export class VisionWorldRenderer {
  private readonly scene: Phaser.Scene;
  private city: City | null = null;
  private fog: FogOfWar | null = null;

  private roadMap: Phaser.Tilemaps.Tilemap | null = null;
  private roadLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private sidewalkMap: Phaser.Tilemaps.Tilemap | null = null;
  private sidewalkLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private terrainByKey = new Map<string, TerrainBucket>();
  private zonesGfx: Phaser.GameObjects.Graphics | null = null;
  private propsContainer: Phaser.GameObjects.Container | null = null;
  private fxContainer: Phaser.GameObjects.Container | null = null;
  private ambientFx: AmbientFxHandle[] = [];
  private isNight = false;

  private fogRt: Phaser.GameObjects.RenderTexture | null = null;
  private visionBrush: Phaser.GameObjects.Image | null = null;
  private softBrushKey = 'fog-soft-vision-brush-v2';

  private builtChunks = new Set<number>();
  private paintedCells = new Set<number>();
  private drawnStructures = new Set<string>();
  private drawnAmbient = new Set<string>();
  private structuresByChunk = new Map<number, StructureInstance[]>();
  private ambientByChunk = new Map<number, AmbientProp[]>();
  private pendingChunks: number[] = [];
  private pendingCells: number[] = [];
  private pendingChunkSet = new Set<number>();
  private pendingCellSet = new Set<number>();
  private lastCamChunkKey = '';

  private roadFirstGid = 1;
  private sidewalkFirstGid = 1;
  private useRoadTiles = false;
  private useSidewalkTiles = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  getPixelSize(city: City): { width: number; height: number } {
    return {
      width: city.grid.w * city.tileSize,
      height: city.grid.h * city.tileSize,
    };
  }

  getFog(): FogOfWar | null {
    return this.fog;
  }

  clear(): void {
    this.fogRt?.destroy();
    this.fogRt = null;
    this.visionBrush?.destroy();
    this.visionBrush = null;
    this.roadLayer?.destroy();
    this.roadLayer = null;
    this.roadMap?.destroy();
    this.roadMap = null;
    this.sidewalkLayer?.destroy();
    this.sidewalkLayer = null;
    this.sidewalkMap?.destroy();
    this.sidewalkMap = null;
    for (const t of this.terrainByKey.values()) {
      t.layer.destroy();
      t.map.destroy();
    }
    this.terrainByKey.clear();
    this.zonesGfx?.destroy();
    this.zonesGfx = null;
    this.propsContainer?.destroy(true);
    this.propsContainer = null;
    this.fxContainer?.destroy(true);
    this.fxContainer = null;
    this.ambientFx = [];
    this.builtChunks.clear();
    this.paintedCells.clear();
    this.drawnStructures.clear();
    this.drawnAmbient.clear();
    this.structuresByChunk.clear();
    this.ambientByChunk.clear();
    this.pendingChunks = [];
    this.pendingCells = [];
    this.pendingChunkSet.clear();
    this.pendingCellSet.clear();
    this.lastCamChunkKey = '';
    this.city = null;
    this.fog = null;
    this.useRoadTiles = false;
    this.useSidewalkTiles = false;
  }

  /** Prepara layers vazios. Não pinta o mapa inteiro. */
  bind(city: City): void {
    this.clear();
    this.city = city;
    const { w, h } = city.grid;
    this.fog = new FogOfWar(w, h);

    this.zonesGfx = this.scene.add.graphics().setDepth(0);
    this.propsContainer = this.scene.add.container(0, 0).setDepth(6);
    this.fxContainer = this.scene.add.container(0, 0).setDepth(8);

    this.indexStructures(city);
    this.indexAmbient(city);
    this.initTileLayers(city);
    this.ensureSoftVisionBrush();
    this.initFogOverlay();
  }

  /**
   * World Generator: materializa chunks visíveis sem névoa de jogo.
   */
  syncPreviewFrame(): void {
    if (!this.city) return;
    this.enqueueCameraChunks();
    this.flushPending();
  }

  /** Oculta overlay de névoa (modo inspecção). */
  setFogOverlayVisible(visible: boolean): void {
    this.fogRt?.setVisible(visible);
  }

  /**
   * Cada frame: streaming pela câmara + névoa centrada no jogador.
   */
  syncFrame(
    worldX: number,
    worldY: number,
    visionTiles: number,
    isNight = visionTiles <= NIGHT_VISION_TILES,
  ): void {
    if (!this.city || !this.fog) return;

    this.enqueueCameraChunks();
    this.flushPending();

    const ts = this.city.tileSize;
    const tileX = Math.floor(worldX / ts);
    const tileY = Math.floor(worldY / ts);
    const outerVision = visionOuterTiles(visionTiles);
    this.fog.revealCircle(tileX, tileY, outerVision);

    this.isNight = isNight;
    this.refreshFogOverlay(worldX, worldY, visionTiles, isNight);
  }

  /**
   * Só redesenha o overlay de névoa (chamar após o follow da câmara
   * para o buraco de visão ficar alinhado ao jogador nas bordas).
   */
  syncFogOverlay(
    worldX: number,
    worldY: number,
    visionTiles: number,
    isNight: boolean,
  ): void {
    this.isNight = isNight;
    this.refreshFogOverlay(worldX, worldY, visionTiles, isNight);
  }

  /** Flicker de fogos e postes. */
  updateFx(timeMs: number): void {
    for (const fx of this.ambientFx) {
      updateAmbientFx(fx, timeMs, this.isNight);
    }
  }

  /** Alias legado. */
  syncVision(worldX: number, worldY: number, visionTiles: number): void {
    this.syncFrame(worldX, worldY, visionTiles);
  }

  destroy(): void {
    this.clear();
  }

  private indexStructures(city: City): void {
    this.structuresByChunk.clear();
    for (const s of city.structures) {
      const cx0 = Math.floor(s.bounds.x / CHUNK_SIZE);
      const cy0 = Math.floor(s.bounds.y / CHUNK_SIZE);
      const cx1 = Math.floor((s.bounds.x + s.bounds.w - 1) / CHUNK_SIZE);
      const cy1 = Math.floor((s.bounds.y + s.bounds.h - 1) / CHUNK_SIZE);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const k = cx + cy * 10000;
          let list = this.structuresByChunk.get(k);
          if (!list) {
            list = [];
            this.structuresByChunk.set(k, list);
          }
          if (!list.includes(s)) list.push(s);
        }
      }
    }
  }

  private indexAmbient(city: City): void {
    this.ambientByChunk.clear();
    for (const p of city.ambientProps) {
      const k =
        Math.floor(p.x / CHUNK_SIZE) + Math.floor(p.y / CHUNK_SIZE) * 10000;
      let list = this.ambientByChunk.get(k);
      if (!list) {
        list = [];
        this.ambientByChunk.set(k, list);
      }
      list.push(p);
    }
  }

  /** Enfileira chunks que intersectam o worldView (+ padding). Estado já criado fica. */
  private enqueueCameraChunks(): void {
    if (!this.city) return;
    const cam = this.scene.cameras.main;
    const ts = this.city.tileSize;
    const { w, h } = this.city.grid;
    const view = cam.worldView;

    const pad = CHUNK_SIZE * CAMERA_CHUNK_PADDING;
    const tx0 = Math.max(0, Math.floor(view.x / ts) - pad);
    const ty0 = Math.max(0, Math.floor(view.y / ts) - pad);
    const tx1 = Math.min(w - 1, Math.ceil(view.right / ts) + pad);
    const ty1 = Math.min(h - 1, Math.ceil(view.bottom / ts) + pad);

    const cx0 = Math.floor(tx0 / CHUNK_SIZE);
    const cy0 = Math.floor(ty0 / CHUNK_SIZE);
    const cx1 = Math.floor(tx1 / CHUNK_SIZE);
    const cy1 = Math.floor(ty1 / CHUNK_SIZE);
    const key = `${cx0},${cy0},${cx1},${cy1}`;
    if (key === this.lastCamChunkKey) return;
    this.lastCamChunkKey = key;

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const ck = cx + cy * 10000;
        if (this.builtChunks.has(ck) || this.pendingChunkSet.has(ck)) continue;
        this.pendingChunkSet.add(ck);
        this.pendingChunks.push(ck);

        const x0 = cx * CHUNK_SIZE;
        const y0 = cy * CHUNK_SIZE;
        const x1 = Math.min(w, x0 + CHUNK_SIZE);
        const y1 = Math.min(h, y0 + CHUNK_SIZE);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * w + x;
            if (this.paintedCells.has(i) || this.pendingCellSet.has(i)) continue;
            this.pendingCellSet.add(i);
            this.pendingCells.push(i);
          }
        }
      }
    }
  }

  private flushPending(): void {
    if (!this.city) return;
    let cells = 0;
    let chunks = 0;

    withRoadSegmentIndex(this.city, () => {
      while (cells < MAX_CELLS_PER_FRAME && this.pendingCells.length > 0) {
        const i = this.pendingCells.shift()!;
        this.pendingCellSet.delete(i);
        this.materializeCell(i);
        cells += 1;
      }
    });

    while (chunks < MAX_CHUNKS_PER_FRAME && this.pendingChunks.length > 0) {
      const ck = this.pendingChunks.shift()!;
      this.pendingChunkSet.delete(ck);
      this.materializeChunk(ck);
      chunks += 1;
    }
  }

  private initTileLayers(city: City): void {
    const { w, h } = city.grid;
    const hasRoads = this.scene.textures.exists(AssetKeys.roads);
    const hasWalks = this.scene.textures.exists(AssetKeys.sidewalks);

    this.initTerrainLayers(city);

    if (hasWalks) {
      const map = this.scene.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: w,
        height: h,
      });
      const ts = map.addTilesetImage(
        AssetKeys.sidewalks,
        AssetKeys.sidewalks,
        TILE_SIZE,
        TILE_SIZE,
        TILE_ATLAS_MARGIN,
        TILE_ATLAS_SPACING,
        1,
      );
      if (ts) {
        const layer = map.createBlankLayer('sw', ts, 0, 0, w, h);
        if (layer) {
          layer.setScale(city.tileSize / TILE_SIZE);
          layer.setDepth(2);
          this.scene.textures
            .get(AssetKeys.sidewalks)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
          this.sidewalkMap = map;
          this.sidewalkLayer = layer;
          this.sidewalkFirstGid = 1;
          this.useSidewalkTiles = true;
        } else map.destroy();
      } else map.destroy();
    }

    if (hasRoads) {
      const map = this.scene.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: w,
        height: h,
      });
      const ts = map.addTilesetImage(
        AssetKeys.roads,
        AssetKeys.roads,
        TILE_SIZE,
        TILE_SIZE,
        TILE_ATLAS_MARGIN,
        TILE_ATLAS_SPACING,
        1,
      );
      if (ts) {
        const layer = map.createBlankLayer('rd', ts, 0, 0, w, h);
        if (layer) {
          layer.setScale(city.tileSize / TILE_SIZE);
          layer.setDepth(3);
          this.scene.textures
            .get(AssetKeys.roads)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
          this.roadMap = map;
          this.roadLayer = layer;
          this.roadFirstGid = 1;
          this.useRoadTiles = true;
        } else map.destroy();
      } else map.destroy();
    }
  }

  private initTerrainLayers(city: City): void {
    const { w, h } = city.grid;
    const key = AssetKeys.grass;
    if (!this.scene.textures.exists(key)) {
      console.warn('[VisionWorldRenderer] grass texture missing');
      return;
    }
    const map = this.scene.make.tilemap({
      tileWidth: GRASS_TILE_SIZE,
      tileHeight: GRASS_TILE_SIZE,
      width: w,
      height: h,
    });
    const tileset = map.addTilesetImage(
      key,
      key,
      GRASS_TILE_SIZE,
      GRASS_TILE_SIZE,
      0,
      0,
      1,
    );
    if (!tileset) {
      console.warn('[VisionWorldRenderer] grass tileset failed');
      map.destroy();
      return;
    }
    const layer = map.createBlankLayer('terrain-grass', tileset, 0, 0, w, h);
    if (!layer) {
      map.destroy();
      return;
    }
    layer.setScale(city.tileSize / GRASS_TILE_SIZE);
    layer.setDepth(1);
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.terrainByKey.set(key, {
      key,
      map,
      layer,
      firstGid: tileset.firstgid,
    });
  }

  private materializeCell(i: number): void {
    if (!this.city || this.paintedCells.has(i)) return;
    this.paintedCells.add(i);
    const { w } = this.city.grid;
    const x = i % w;
    const y = (i / w) | 0;
    const ts = this.city.tileSize;
    const isRoad = !!this.city.roadGrid[i];
    const isWalk = !!this.city.sidewalkGrid[i] && !isRoad;

    // Solo: só a textura de grama do utilizador (ou tint noutras zonas)
    if (!isRoad && !isWalk) {
      const zone = this.city.zoneGrid[i]!;
      const ref = terrainTile(zone, x, y);
      if (ref) {
        const bucket = this.terrainByKey.get(ref.sheet);
        if (bucket) {
          bucket.layer.putTileAt(bucket.firstGid + ref.frame, x, y);
        } else if (this.zonesGfx) {
          this.zonesGfx.fillStyle(ZONE_TINTS[zone], 1);
          this.zonesGfx.fillRect(x * ts, y * ts, ts, ts);
        }
      } else if (this.zonesGfx) {
        this.zonesGfx.fillStyle(ZONE_TINTS[zone], 1);
        this.zonesGfx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    if (isWalk) {
      if (this.useSidewalkTiles && this.sidewalkLayer) {
        const p = chooseSidewalkTile(this.city, x, y);
        if (p && p.frame >= 0) {
          this.sidewalkLayer.putTileAt(this.sidewalkFirstGid + p.frame, x, y);
        }
      } else if (this.zonesGfx) {
        this.zonesGfx.fillStyle(SIDEWALK_FALLBACK, 1);
        this.zonesGfx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    const road = this.city.roadGrid[i];
    if (road) {
      if (this.useRoadTiles && this.roadLayer) {
        const p = chooseRoadTile(this.city, x, y);
        if (p && p.frame >= 0) {
          this.roadLayer.putTileAt(this.roadFirstGid + p.frame, x, y);
        }
      } else if (this.zonesGfx) {
        const inset = ((1 - ROAD_WIDTH[road]) * ts) / 2;
        this.zonesGfx.fillStyle(0x1a1b1f, 1);
        this.zonesGfx.fillRect(x * ts, y * ts, ts, ts);
        this.zonesGfx.fillStyle(ROAD_COLORS[road], 1);
        this.zonesGfx.fillRect(
          x * ts + inset,
          y * ts + inset,
          ts - inset * 2,
          ts - inset * 2,
        );
      }
    }
  }

  private materializeChunk(ck: number): void {
    if (!this.city || this.builtChunks.has(ck)) return;
    this.builtChunks.add(ck);
    if (!this.propsContainer) return;

    const ts = this.city.tileSize;
    const structs = this.structuresByChunk.get(ck);
    if (structs) {
      for (const s of structs) {
        if (this.drawnStructures.has(s.id)) continue;
        this.drawnStructures.add(s.id);
        this.drawStructure(s, ts);
      }
    }

    for (const poi of this.city.explorationPoints) {
      const pcx = Math.floor(poi.x / CHUNK_SIZE);
      const pcy = Math.floor(poi.y / CHUNK_SIZE);
      if (pcx + pcy * 10000 !== ck) continue;
      const px = poi.x * ts + ts / 2;
      const py = poi.y * ts + ts / 2;

      if (
        CAR_POI_TYPE_IDS.has(poi.typeId) &&
        this.scene.textures.exists(AssetKeys.wreckedCars)
      ) {
        const frame = pickWreckedCarFrame(poi.id);
        const scale = wreckedCarDisplayScale(ts);
        const img = this.scene.add.image(px, py, AssetKeys.wreckedCars, frame);
        img.setRotation(stableCarRotation(poi.id));
        img.setScale(scale);
        img.setOrigin(0.5, 0.5);
        this.propsContainer.add(img);
        continue;
      }

      const propKey = getPoiSpriteKey(poi.typeId, poi.id);
      if (propKey && this.scene.textures.exists(propKey)) {
        const scale = worldPropDisplayScale(ts, propKey);
        const img = this.scene.add.image(px, py, propKey);
        img.setRotation(stablePropRotation(poi.id, poi.typeId));
        img.setScale(scale);
        img.setOrigin(0.5, 0.5);
        this.propsContainer.add(img);
        continue;
      }

      let color = 0xffaa00;
      try {
        color = getStructureDef(poi.typeId).color;
      } catch {
        /* */
      }
      const g = this.scene.add.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(px, py, Math.max(2, ts * 0.35));
      g.lineStyle(1, 0x000000, 0.45);
      g.strokeCircle(px, py, Math.max(2, ts * 0.35));
      this.propsContainer.add(g);
    }

    const ambients = this.ambientByChunk.get(ck);
    if (ambients) {
      for (const p of ambients) {
        if (this.drawnAmbient.has(p.id)) continue;
        this.drawnAmbient.add(p.id);
        this.drawAmbientProp(p, ts);
      }
    }
  }

  private drawAmbientProp(p: AmbientProp, ts: number): void {
    if (!this.propsContainer || !this.fxContainer) return;
    if (
      p.kind === 'tree' ||
      p.kind === 'bush' ||
      p.kind === 'plant' ||
      p.kind === 'crop' ||
      p.kind === 'rock' ||
      p.kind === 'stump'
    ) {
      return;
    }

    const cx = p.x * ts + ts / 2;
    const cy = p.y * ts + ts / 2;

    if (p.kind === 'wrecked_car') {
      if (this.scene.textures.exists(AssetKeys.wreckedCars)) {
        const frame = p.frame ?? pickWreckedCarFrame(p.id);
        const scale = (p.scale ?? 1) * wreckedCarDisplayScale(ts);
        const img = this.scene.add.image(cx, cy, AssetKeys.wreckedCars, frame);
        img.setRotation(p.rotation);
        img.setScale(scale);
        img.setOrigin(0.5, 0.5);
        this.propsContainer.add(img);
        return;
      }
    }

    const g = this.scene.add.graphics();
    g.setPosition(cx, cy);
    g.setRotation(p.rotation);

    if (p.kind === 'wrecked_car') {
      g.fillStyle(0x3a3f46, 1);
      g.fillRect(-ts * 0.7, -ts * 0.35, ts * 1.4, ts * 0.7);
      g.fillStyle(0x1f2328, 1);
      g.fillRect(-ts * 0.35, -ts * 0.28, ts * 0.55, ts * 0.35);
      g.fillStyle(0x6b7280, 1);
      g.fillCircle(-ts * 0.45, ts * 0.28, ts * 0.18);
      g.fillCircle(ts * 0.45, ts * 0.28, ts * 0.18);
      g.fillStyle(0xff7043, 0.55);
      g.fillRect(ts * 0.15, -ts * 0.1, ts * 0.35, ts * 0.12);
    } else if (p.kind === 'debris' || p.kind === 'burning_debris') {
      g.fillStyle(0x5c4033, 1);
      g.fillTriangle(-ts * 0.4, ts * 0.25, ts * 0.1, -ts * 0.35, ts * 0.45, ts * 0.3);
      g.fillStyle(0x7a7a7a, 1);
      g.fillRect(-ts * 0.25, -ts * 0.05, ts * 0.45, ts * 0.2);
      g.fillStyle(0x9aa0a6, 0.9);
      g.fillCircle(ts * 0.2, ts * 0.15, ts * 0.12);
    } else if (p.kind === 'lamp_post') {
      g.fillStyle(0x2c3138, 1);
      g.fillRect(-ts * 0.08, -ts * 0.85, ts * 0.16, ts * 1.1);
      g.fillStyle(0x3d4450, 1);
      g.fillRect(-ts * 0.22, -ts * 0.95, ts * 0.44, ts * 0.18);
      g.fillStyle(0xffe082, 1);
      g.fillCircle(0, -ts * 0.86, ts * 0.12);
    }

    this.propsContainer.add(g);

    if (p.kind === 'burning_debris') {
      this.ambientFx.push(
        createFireFx(this.scene, this.fxContainer, cx, cy, ts),
      );
    }

    if (p.kind === 'lamp_post') {
      this.ambientFx.push(
        createLampFx(this.scene, this.fxContainer, cx, cy, ts),
      );
    }
  }

  private drawStructure(s: StructureInstance, ts: number): void {
    if (!this.propsContainer) return;
    let color = 0x888888;
    try {
      const def = getStructureDef(s.typeId);
      color = def.color;
      if (s.category === 'secondary') {
        color = Phaser.Display.Color.IntegerToColor(color).darken(18).color;
      }
    } catch {
      /* */
    }
    const bx = s.bounds.x * ts;
    const by = s.bounds.y * ts;
    const bw = s.bounds.w * ts;
    const bh = s.bounds.h * ts;
    const g = this.scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(bx, by, bw, Math.max(2, bh * 0.22));
    g.lineStyle(1, 0x000000, 0.45);
    g.strokeRect(bx, by, bw, bh);
    this.propsContainer.add(g);
  }

  /** Brush radial suave: centro opaco → bordo transparente (furo de visão). */
  private ensureSoftVisionBrush(): void {
    if (this.scene.textures.exists(this.softBrushKey)) return;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    // Raio do brush = visão nítida + penumbra (33%).
    // Nítido até ~75% do raio (= 1/1.33), fade até à borda.
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.72, 'rgba(255,255,255,1)');
    grad.addColorStop(0.82, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.92, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.scene.textures.addCanvas(this.softBrushKey, canvas);
  }

  private initFogOverlay(): void {
    const cam = this.scene.cameras.main;
    this.fogRt = this.scene.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      // Acima de inimigos/recursos (≤55), abaixo do jogador (70).
      .setDepth(62);
  }

  private refreshFogOverlay(
    worldX: number,
    worldY: number,
    visionTiles: number,
    isNight: boolean,
  ): void {
    if (!this.fogRt || !this.city) return;
    const cam = this.scene.cameras.main;
    const w = Math.max(1, Math.ceil(cam.width));
    const h = Math.max(1, Math.ceil(cam.height));
    if (this.fogRt.width !== w || this.fogRt.height !== h) {
      this.fogRt.resize(w, h);
    }

    const fogColor = isNight ? 0x02040a : 0x05070c;

    const ts = this.city.tileSize;
    // worldView respeita zoom + bounds — evita desalinhamento nas bordas.
    const view = cam.worldView;
    const sx =
      view.width > 0 ? ((worldX - view.x) / view.width) * w : w / 2;
    const sy =
      view.height > 0 ? ((worldY - view.y) / view.height) * h : h / 2;
    const outerTiles = visionOuterTiles(visionTiles);
    const radiusPx = Math.max(8, outerTiles * ts * cam.zoom);

    if (!this.visionBrush) {
      this.visionBrush = this.scene.add
        .image(0, 0, this.softBrushKey)
        .setVisible(false)
        .setOrigin(0.5, 0.5);
    }
    this.visionBrush.setScale((radiusPx * 2) / 256);

    this.fogRt.clear();
    this.fogRt.fill(fogColor, 1);
    this.fogRt.erase(this.visionBrush, sx, sy);
  }
}
