export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RoadType = 'highway' | 'main' | 'avenue' | 'street' | 'residential';

export type ZoneType =
  | 'center'
  | 'commercial'
  | 'mixed'
  | 'residential_med'
  | 'residential_low'
  | 'suburban'
  | 'periphery'
  | 'industrial'
  | 'rural';

export type Density = 'high' | 'medium' | 'low' | 'sparse';

export type CitySizeClass = 'small' | 'medium' | 'large';

/** Tamanho usado ao iniciar uma partida (Jogar) e quando o gerador não fixa tamanho. */
export const DEFAULT_PLAY_CITY_SIZE: CitySizeClass = 'medium';

export type StructureCategory = 'primary' | 'secondary' | 'exploration';

export type BiomeType = 'forest' | 'field' | 'rural' | 'urban' | 'mixed';

export interface RoadAccess {
  /** Fração da borda do lote que toca estrada/calçada (0–1). */
  fraction: number;
  bestRoadType: RoadType | null;
  /** Lados do lote que tocam via ou calçada (frente da quadra). */
  touchN: boolean;
  touchE: boolean;
  touchS: boolean;
  touchW: boolean;
}

export interface RoadSegment {
  id: string;
  type: RoadType;
  rect: Rect;
}

export interface Lot {
  id: string;
  bounds: Rect;
  zone: ZoneType;
  density: Density;
  roadAccess: RoadAccess;
  size: number;
  neighbors: string[];
  structureIds: string[];
}

/** Stub futuro — interiores. */
export interface Room {
  id: string;
  type: string;
  bounds: Rect;
  objects: WorldObject[];
  lootSpawns: LootSpawn[];
}

export interface WorldObject {
  id: string;
  typeId: string;
  x: number;
  y: number;
}

export interface LootSpawn {
  id: string;
  x: number;
  y: number;
}

export interface Entrance {
  id: string;
  x: number;
  y: number;
}

export interface StructureInstance {
  id: string;
  typeId: string;
  category: StructureCategory;
  lotId: string | null;
  parentId: string | null;
  bounds: Rect;
  rooms: Room[];
  entrances: Entrance[];
  metadata: Record<string, unknown>;
}

export interface ExplorationPoint {
  id: string;
  typeId: string;
  x: number;
  y: number;
  loot: LootSpawn[];
}

/** Props de ambientação (highways, postes, vegetação, etc.). */
export type AmbientPropKind =
  | 'wrecked_car'
  | 'debris'
  | 'burning_debris'
  | 'lamp_post'
  | 'tree'
  | 'bush'
  | 'plant'
  | 'rock'
  | 'stump'
  | 'crop';

export interface AmbientProp {
  id: string;
  kind: AmbientPropKind;
  x: number;
  y: number;
  /** Rotação em radianos. */
  rotation: number;
  /** Spritesheet (nature / Kenney). */
  sheet?: string;
  frame?: number;
  /** Escala de display relativa ao tile (1 = 1 tile). */
  scale?: number;
  /** Bloqueia movimento do jogador. */
  blocks?: boolean;
}

export interface NarrativeSlot {
  id: string;
  key: string;
  structureId: string | null;
  note: string;
}

export interface City {
  id: string;
  name: string;
  seed: number;
  sizeClass: CitySizeClass;
  tileSize: number;
  /** Profile que guiou / documentou esta geração. */
  profileId: string;
  bounds: Rect;
  center: Point;
  grid: { w: number; h: number };
  /** roadType por tile, null = sem estrada */
  roadGrid: (RoadType | null)[];
  roads: RoadSegment[];
  /**
   * Calçada em volta das quadras (anel junto às vias).
   * Não entra em roadGrid — é layer à parte.
   */
  sidewalkGrid: boolean[];
  /** zone por tile */
  zoneGrid: ZoneType[];
  /** density por tile */
  densityGrid: Density[];
  lots: Lot[];
  structures: StructureInstance[];
  explorationPoints: ExplorationPoint[];
  ambientProps: AmbientProp[];
  narrativeSlots: NarrativeSlot[];
}

export interface Region {
  id: string;
  biome: BiomeType;
  bounds: Rect;
  cities: City[];
  roads: RoadSegment[];
  structures: StructureInstance[];
}

export interface World {
  seed: number;
  regions: Region[];
}

export interface GenerateWorldOptions {
  seed?: number;
  sizeClass?: CitySizeClass;
  tileSize?: number;
  /** City profile id (default HeuristicV1). */
  profileId?: string;
}

export interface GeneratedCityMeta {
  profileId: string;
  profileOrigin: 'heuristic' | 'osm-derived';
}

