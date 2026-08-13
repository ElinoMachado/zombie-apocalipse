import { describe, expect, it } from 'vitest';
import { resolveZombieMeleeAttack } from '../../src/game/combat/zombieMeleeAttack';
import { collectPlayerStatusBadges } from '../../src/game/survival/survivalStatusBadges';
import { SurvivalState } from '../../src/game/survival/SurvivalState';

describe('resolveZombieMeleeAttack', () => {
  it('marca crítico só com natural 20 no d20 de ataque', () => {
    let i = 0;
    const seq = [0, 0.99, 0, 0]; // dano min; atk roll 20; extras
    const rng = () => seq[i++] ?? 0;

    const hit = resolveZombieMeleeAttack(2, 6, rng);
    expect(hit.critical).toBe(true);
    expect(hit.damage).toBeGreaterThan(0);
  });

  it('não marca crítico fora do natural 20', () => {
    let i = 0;
    const seq = [0, 0.5, 0, 0];
    const rng = () => seq[i++] ?? 0;

    const hit = resolveZombieMeleeAttack(2, 6, rng);
    expect(hit.critical).toBe(false);
  });
});

describe('collectPlayerStatusBadges', () => {
  it('inclui sangramento e queimadura quando activos', () => {
    const survival = new SurvivalState();
    survival.bleeding = true;

    const badges = collectPlayerStatusBadges(survival, { burning: true });
    expect(badges.map((b) => b.id)).toEqual(
      expect.arrayContaining(['bleeding', 'burning']),
    );
  });

  it('fica vazio sem condições', () => {
    const survival = new SurvivalState();
    expect(collectPlayerStatusBadges(survival)).toEqual([]);
  });
});
