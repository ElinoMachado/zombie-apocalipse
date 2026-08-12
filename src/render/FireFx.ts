import Phaser from 'phaser';

const PARTICLE_KEY = 'fx-soft-particle';

function ensureParticleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARTICLE_KEY)) return;
  const size = 32;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(size / 2, size / 2, size / 2 - 1);
  g.generateTexture(PARTICLE_KEY, size, size);
  g.destroy();
}

export type AmbientFxHandle =
  | {
      kind: 'fire';
      root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  flames: Phaser.GameObjects.Ellipse[];
  particles: Phaser.GameObjects.Particles.ParticleEmitter;
  phase: number;
}
  | {
      kind: 'lamp';
      glow: Phaser.GameObjects.Arc;
      core: Phaser.GameObjects.Arc;
      phase: number;
    };

/** Chamas com glow + línguas + partículas (brasas / fumo). */
export function createFireFx(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  tileSize: number,
): AmbientFxHandle {
  ensureParticleTexture(scene);
  const ts = tileSize;
  const root = scene.add.container(x, y);
  parent.add(root);

  const glow = scene.add.circle(0, -ts * 0.1, ts * 1.6, 0xff3d00, 0.28);
  glow.setBlendMode(Phaser.BlendModes.ADD);

  const outer = scene.add.ellipse(0, -ts * 0.35, ts * 0.95, ts * 1.35, 0xff6d00, 0.55);
  outer.setBlendMode(Phaser.BlendModes.ADD);
  const mid = scene.add.ellipse(0, -ts * 0.55, ts * 0.55, ts * 1.05, 0xffab00, 0.7);
  mid.setBlendMode(Phaser.BlendModes.ADD);
  const tip = scene.add.ellipse(0, -ts * 0.85, ts * 0.28, ts * 0.65, 0xfff59d, 0.85);
  tip.setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.ellipse(0, -ts * 0.35, ts * 0.22, ts * 0.4, 0xffffff, 0.55);
  core.setBlendMode(Phaser.BlendModes.ADD);

  root.add([glow, outer, mid, tip, core]);

  const particles = scene.add.particles(0, -ts * 0.2, PARTICLE_KEY, {
    lifespan: { min: 400, max: 900 },
    speed: { min: 18, max: 55 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.35, end: 0 },
    alpha: { start: 0.85, end: 0 },
    gravityY: -25,
    frequency: 55,
    quantity: 1,
    blendMode: 'ADD',
    tint: [0xff3d00, 0xff6d00, 0xffab00, 0xffee58, 0x9e9e9e],
  });
  root.add(particles);

  return {
    kind: 'fire',
    root,
    glow,
    flames: [outer, mid, tip, core],
    particles,
    phase: Math.random() * Math.PI * 2,
  };
}

export function createLampFx(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  tileSize: number,
): AmbientFxHandle {
  const ts = tileSize;
  const glow = scene.add.circle(x, y - ts * 0.4, ts * 2.4, 0xffe082, 0.2);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.circle(x, y - ts * 0.85, ts * 0.35, 0xfff3c4, 0.4);
  core.setBlendMode(Phaser.BlendModes.ADD);
  parent.add([glow, core]);
  return {
    kind: 'lamp',
    glow,
    core,
    phase: Math.random() * Math.PI * 2,
  };
}

export function updateAmbientFx(
  fx: AmbientFxHandle,
  timeMs: number,
  isNight: boolean,
): void {
  if (fx.kind === 'fire') {
    const p = fx.phase;
    const a = 0.82 + Math.sin(timeMs * 0.018 + p) * 0.12;
    const b = 0.78 + Math.sin(timeMs * 0.027 + p * 1.7) * 0.18;
    const c = 0.85 + Math.sin(timeMs * 0.041 + p * 0.6) * 0.12;
    fx.glow.setAlpha(0.22 + a * 0.18);
    fx.glow.setScale(0.95 + b * 0.2);
    const [outer, mid, tip, core] = fx.flames;
    outer?.setScale(0.9 + a * 0.25, 0.85 + b * 0.35).setAlpha(0.4 + a * 0.25);
    mid?.setScale(0.85 + b * 0.3, 0.9 + c * 0.35).setAlpha(0.55 + b * 0.3);
    tip?.setScale(0.75 + c * 0.4, 0.95 + a * 0.4).setAlpha(0.65 + c * 0.3);
    core?.setScale(0.8 + a * 0.35, 0.85 + b * 0.3).setAlpha(0.4 + c * 0.35);
    // sway
    outer?.setPosition(Math.sin(timeMs * 0.011 + p) * 1.5, outer.y);
    mid?.setPosition(Math.sin(timeMs * 0.014 + p + 1) * 2, mid.y);
    tip?.setPosition(Math.sin(timeMs * 0.017 + p + 2) * 2.5, tip.y);
    return;
  }

  const flicker = 0.75 + Math.sin(timeMs * 0.012 + fx.phase) * 0.18;
  const nightBoost = isNight ? 1.25 : 0.55;
  fx.glow.setAlpha(0.22 * nightBoost * flicker);
  fx.core.setAlpha(0.45 * nightBoost * flicker);
}
