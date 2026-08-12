import Phaser from 'phaser';
import { AssetKeys, TILE_ATLAS_MARGIN, TILE_ATLAS_SPACING, TILE_SIZE } from '../assets/manifest';
import { chooseRoadTile, chooseSidewalkTile, withRoadSegmentIndex } from '../assets/smart';
import { ROAD_COLORS, ZONE_TINTS } from '../world/catalog/types';
import { getStructureDef } from '../world/catalog/structures';
import type { City, RoadType } from '../world/model/types';

/** Fallback se o tileset ainda não carregou. */
const ROAD_WIDTH: Record<RoadType, number> = {
  highway: 1,
  main: 0.92,
  avenue: 0.82,
  street: 0.68,
  residential: 0.55,
};

const SIDEWALK_FALLBACK = 0xc6c8cc;

export class WorldDebugRenderer {
  private readonly scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private labels: Phaser.GameObjects.Text[] = [];
  private roadMap: Phaser.Tilemaps.Tilemap | null = null;
  private roadLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private sidewalkMap: Phaser.Tilemaps.Tilemap | null = null;
  private sidewalkLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  clear(): void {
    for (const label of this.labels) label.destroy();
    this.labels = [];
    this.roadLayer?.destroy();
    this.roadLayer = null;
    this.roadMap?.destroy();
    this.roadMap = null;
    this.sidewalkLayer?.destroy();
    this.sidewalkLayer = null;
    this.sidewalkMap?.destroy();
    this.sidewalkMap = null;
    this.container?.destroy(true);
    this.container = null;
  }

  render(city: City): void {
    this.clear();

    const ts = city.tileSize;
    const { w, h } = city.grid;
    const g = this.scene.add.graphics();
    this.container = this.scene.add.container(0, 0, [g]);

    g.fillStyle(0x0c1016, 1);
    g.fillRect(0, 0, w * ts, h * ts);

    // Zonas — RLE por linha (menos fillRect)
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const zone = city.zoneGrid[y * w + x]!;
        let x2 = x + 1;
        while (x2 < w && city.zoneGrid[y * w + x2] === zone) x2 += 1;
        g.fillStyle(ZONE_TINTS[zone], 0.95);
        g.fillRect(x * ts, y * ts, (x2 - x) * ts, ts);
        x = x2;
      }
    }

    // Grelha subtil (mais espaçada em mapas grandes)
    const gridStep = w > 200 ? 8 : 4;
    g.lineStyle(1, 0x1c2430, 0.25);
    for (let x = 0; x <= w; x += gridStep) {
      g.lineBetween(x * ts, 0, x * ts, h * ts);
    }
    for (let y = 0; y <= h; y += gridStep) {
      g.lineBetween(0, y * ts, w * ts, y * ts);
    }

    // Lotes (contorno)
    g.lineStyle(1, 0xffffff, 0.07);
    for (const lot of city.lots) {
      g.strokeRect(
        lot.bounds.x * ts,
        lot.bounds.y * ts,
        lot.bounds.w * ts,
        lot.bounds.h * ts,
      );
    }

    const usedSidewalks = this.paintSidewalks(city, ts, g);
    const usedTiles = this.paintRoads(city, ts, g);

    // Centro urbano
    {
      const cx = city.center.x * ts + ts / 2;
      const cy = city.center.y * ts + ts / 2;
      g.lineStyle(1, 0xfbbf24, 0.55);
      g.strokeCircle(cx, cy, ts * 1.2);
      g.lineBetween(cx - ts, cy, cx + ts, cy);
      g.lineBetween(cx, cy - ts, cx, cy + ts);
    }

    // Estruturas
    for (const s of city.structures) {
      let color = 0x888888;
      let label = s.typeId;
      try {
        const def = getStructureDef(s.typeId);
        color = def.color;
        label = def.label;
        if (s.category === 'secondary') {
          color = Phaser.Display.Color.IntegerToColor(color).darken(18).color;
        }
      } catch {
        /* keep defaults */
      }

      const bx = s.bounds.x * ts;
      const by = s.bounds.y * ts;
      const bw = s.bounds.w * ts;
      const bh = s.bounds.h * ts;

      g.fillStyle(color, 1);
      g.fillRect(bx, by, bw, bh);
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(bx, by, bw, Math.max(2, bh * 0.22));
      g.lineStyle(1, 0x000000, 0.45);
      g.strokeRect(bx, by, bw, bh);

      if (s.category === 'primary' && bw >= 48 && this.labels.length < 40) {
        const t = this.scene.add
          .text(bx + 2, by + 2, label, {
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: '9px',
            color: '#0d1117',
            fontStyle: 'bold',
          })
          .setDepth(6);
        this.labels.push(t);
        this.container.add(t);
      }
    }

    // POIs de exploração
    for (const poi of city.explorationPoints) {
      let color = 0xffaa00;
      try {
        color = getStructureDef(poi.typeId).color;
      } catch {
        /* */
      }
      const cx = poi.x * ts + ts / 2;
      const cy = poi.y * ts + ts / 2;
      g.fillStyle(color, 1);
      g.fillCircle(cx, cy, Math.max(2, ts * 0.35));
      g.lineStyle(1, 0x000000, 0.45);
      g.strokeCircle(cx, cy, Math.max(2, ts * 0.35));
    }

    const title = this.scene.add
      .text(
        8,
        8,
        `${city.name} · ${city.sizeClass} · ${city.profileId}${usedTiles ? ' · roads' : ''}${usedSidewalks ? ' · sidewalks' : ''}`,
        {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '13px',
          color: '#e6edf3',
          backgroundColor: '#0d1117aa',
          padding: { x: 6, y: 4 },
        },
      )
      .setDepth(10);
    this.labels.push(title);
    this.container.add(title);

    this.drawLegend(city, ts);
    this.container.setDepth(1);
  }

  private paintSidewalksGraphics(
    city: City,
    ts: number,
    g: Phaser.GameObjects.Graphics,
  ): void {
    const { w, h } = city.grid;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!city.sidewalkGrid[i] || city.roadGrid[i]) continue;
        g.fillStyle(SIDEWALK_FALLBACK, 1);
        g.fillRect(x * ts, y * ts, ts, ts);
      }
    }
  }

  /** @returns true se usou o tileset de calçadas */
  private paintSidewalks(
    city: City,
    ts: number,
    g: Phaser.GameObjects.Graphics,
  ): boolean {
    const { w, h } = city.grid;
    if (!this.scene.textures.exists(AssetKeys.sidewalks)) {
      this.paintSidewalksGraphics(city, ts, g);
      return false;
    }

    try {
      const firstGid = 1;
      const map = this.scene.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: w,
        height: h,
      });
      const tileset = map.addTilesetImage(
        AssetKeys.sidewalks,
        AssetKeys.sidewalks,
        TILE_SIZE,
        TILE_SIZE,
        TILE_ATLAS_MARGIN,
        TILE_ATLAS_SPACING,
        firstGid,
      );
      if (!tileset || tileset.total <= 0) {
        map.destroy();
        this.paintSidewalksGraphics(city, ts, g);
        return false;
      }

      const layer = map.createBlankLayer('sidewalks', tileset, 0, 0, w, h);
      if (!layer) {
        map.destroy();
        this.paintSidewalksGraphics(city, ts, g);
        return false;
      }

      const scale = ts / TILE_SIZE;
      layer.setScale(scale);
      layer.setDepth(1.5);
      this.scene.textures
        .get(AssetKeys.sidewalks)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);

      const maxLocal = tileset.total;
      for (let i = 0; i < w * h; i++) {
        if (!city.sidewalkGrid[i] || city.roadGrid[i]) continue;
        const x = i % w;
        const y = (i / w) | 0;
        const placement = chooseSidewalkTile(city, x, y);
        if (!placement) continue;
        if (placement.frame < 0 || placement.frame >= maxLocal) continue;
        layer.putTileAt(firstGid + placement.frame, x, y);
      }

      this.sidewalkMap = map;
      this.sidewalkLayer = layer;
      return true;
    } catch (err) {
      console.warn(
        '[WorldDebugRenderer] sidewalk tileset failed, using graphics',
        err,
      );
      this.sidewalkLayer?.destroy();
      this.sidewalkLayer = null;
      this.sidewalkMap?.destroy();
      this.sidewalkMap = null;
      this.paintSidewalksGraphics(city, ts, g);
      return false;
    }
  }

  private paintRoadsGraphics(
    city: City,
    ts: number,
    g: Phaser.GameObjects.Graphics,
  ): void {
    const { w, h } = city.grid;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const road = city.roadGrid[y * w + x];
        if (!road) continue;
        const inset = ((1 - ROAD_WIDTH[road]) * ts) / 2;
        g.fillStyle(0x1a1b1f, 1);
        g.fillRect(x * ts, y * ts, ts, ts);
        g.fillStyle(ROAD_COLORS[road], 1);
        g.fillRect(
          x * ts + inset,
          y * ts + inset,
          ts - inset * 2,
          ts - inset * 2,
        );
      }
    }
  }

  /** @returns true se usou o tileset de estradas */
  private paintRoads(city: City, ts: number, g: Phaser.GameObjects.Graphics): boolean {
    const { w, h } = city.grid;
    const hasSheet = this.scene.textures.exists(AssetKeys.roads);

    if (!hasSheet) {
      this.paintRoadsGraphics(city, ts, g);
      return false;
    }

    try {
      // firstgid=1: índice 0 = vazio no Phaser; evita tiles[index] undefined
      const firstGid = 1;
      const map = this.scene.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: w,
        height: h,
      });
      const tileset = map.addTilesetImage(
        AssetKeys.roads,
        AssetKeys.roads,
        TILE_SIZE,
        TILE_SIZE,
        TILE_ATLAS_MARGIN,
        TILE_ATLAS_SPACING,
        firstGid,
      );
      if (!tileset || tileset.total <= 0) {
        map.destroy();
        this.paintRoadsGraphics(city, ts, g);
        return false;
      }

      const layer = map.createBlankLayer('roads', tileset, 0, 0, w, h);
      if (!layer) {
        map.destroy();
        this.paintRoadsGraphics(city, ts, g);
        return false;
      }

      const scale = ts / TILE_SIZE;
      layer.setScale(scale);
      layer.setDepth(2);
      this.scene.textures
        .get(AssetKeys.roads)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);

      const maxLocal = tileset.total;
      withRoadSegmentIndex(city, () => {
        for (let i = 0; i < w * h; i++) {
          if (!city.roadGrid[i]) continue;
          const x = i % w;
          const y = (i / w) | 0;
          const placement = chooseRoadTile(city, x, y);
          if (!placement) continue;
          if (placement.frame < 0 || placement.frame >= maxLocal) continue;
          layer.putTileAt(firstGid + placement.frame, x, y);
        }
      });

      this.roadMap = map;
      this.roadLayer = layer;
      return true;
    } catch (err) {
      console.warn('[WorldDebugRenderer] road tileset failed, using graphics', err);
      this.roadLayer?.destroy();
      this.roadLayer = null;
      this.roadMap?.destroy();
      this.roadMap = null;
      this.paintRoadsGraphics(city, ts, g);
      return false;
    }
  }

  private drawLegend(city: City, ts: number): void {
    const g = this.scene.add.graphics();
    this.container?.add(g);

    const entries: { label: string; color: number }[] = [
      { label: 'highway', color: ROAD_COLORS.highway },
      { label: 'main', color: ROAD_COLORS.main },
      { label: 'avenue', color: ROAD_COLORS.avenue },
      { label: 'street', color: ROAD_COLORS.street },
      { label: 'res.', color: ROAD_COLORS.residential },
      { label: 'calçada', color: SIDEWALK_FALLBACK },
    ];

    const boxW = 118;
    const boxH = 14 + entries.length * 14;
    const x0 = city.grid.w * ts - boxW - 10;
    const y0 = 10;

    g.fillStyle(0x0d1117, 0.82);
    g.fillRoundedRect(x0, y0, boxW, boxH, 4);
    g.lineStyle(1, 0x30363d, 1);
    g.strokeRoundedRect(x0, y0, boxW, boxH, 4);

    entries.forEach((e, i) => {
      const y = y0 + 8 + i * 14;
      g.fillStyle(e.color, 1);
      g.fillRect(x0 + 8, y, 14, 8);
      const t = this.scene.add
        .text(x0 + 28, y - 2, e.label, {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '10px',
          color: '#9aa7b5',
        })
        .setDepth(11);
      this.labels.push(t);
      this.container?.add(t);
    });
  }

  getPixelSize(city: City): { width: number; height: number } {
    return {
      width: city.grid.w * city.tileSize,
      height: city.grid.h * city.tileSize,
    };
  }

  destroy(): void {
    this.clear();
  }
}
