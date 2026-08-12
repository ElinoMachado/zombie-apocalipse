import {
  attributeModifier,
  defaultAttributes,
  type AttributeId,
  type AttributeScores,
} from './attributes';
import {
  generateCharacterProfile,
  type CharacterProfile,
} from './characterProfile';
import {
  getTalentDef,
  type TalentDef,
  type TalentId,
} from './talents';

export const MAX_LEVEL = 20;

/** XP por fonte — zumbis > loot > craft > misc. */
export const XP_REWARDS = {
  kill_zombie: 100,
  loot_search: 25,
  craft: 10,
  miscellaneous: 5,
} as const;

export type XpSource = keyof typeof XP_REWARDS;

export interface LevelUpResult {
  newLevel: number;
  attributePointsGained: number;
  talentPointsGained: number;
}

export class PlayerProgression {
  level = 1;
  xp = 0;
  attributePoints = 0;
  talentPoints = 0;
  readonly attributes: AttributeScores = defaultAttributes();
  readonly profile: CharacterProfile;
  /** talentId → nível (1–6). Mesmo talento só entra uma vez; nível mais alto prevalece. */
  readonly talents: Record<TalentId, number> = {};

  constructor(rng: () => number = Math.random) {
    this.profile = generateCharacterProfile(rng);
  }

  /** XP necessário para subir do nível actual para o seguinte. */
  xpToNextLevel(): number {
    if (this.level >= MAX_LEVEL) return 0;
    return 50 + this.level * 75;
  }

  /** Progresso 0–1 para a barra de XP. */
  xpProgress01(): number {
    const need = this.xpToNextLevel();
    if (need <= 0) return 1;
    return Math.max(0, Math.min(1, this.xp / need));
  }

  grantXp(source: XpSource, multiplier = 1): LevelUpResult[] {
    return this.grantRawXp(XP_REWARDS[source] * multiplier);
  }

  grantRawXp(amount: number): LevelUpResult[] {
    if (amount <= 0 || this.level >= MAX_LEVEL) return [];
    this.xp += amount;
    const ups: LevelUpResult[] = [];
    while (this.level < MAX_LEVEL && this.xp >= this.xpToNextLevel()) {
      this.xp -= this.xpToNextLevel();
      this.level += 1;
      const attrGain = 2;
      const talentGain = this.level % 2 === 0 ? 1 : 0;
      this.attributePoints += attrGain;
      this.talentPoints += talentGain;
      ups.push({
        newLevel: this.level,
        attributePointsGained: attrGain,
        talentPointsGained: talentGain,
      });
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
    return ups;
  }

  spendAttributePoint(id: AttributeId): boolean {
    if (this.attributePoints <= 0) return false;
    this.attributePoints -= 1;
    this.attributes[id] += 1;
    return true;
  }

  getMod(id: AttributeId): number {
    return attributeModifier(this.attributes[id]);
  }

  getTalentLevel(id: TalentId): number {
    return this.talents[id] ?? 0;
  }

  /** Lista de talentos possuídos (ordenada por categoria e nome). */
  listOwnedTalents(): { def: TalentDef; level: number }[] {
    const out: { def: TalentDef; level: number }[] = [];
    for (const [id, level] of Object.entries(this.talents)) {
      const def = getTalentDef(id);
      if (def && level > 0) out.push({ def, level });
    }
    out.sort((a, b) => {
      if (a.def.category !== b.def.category) {
        return a.def.category.localeCompare(b.def.category);
      }
      return a.def.name.localeCompare(b.def.name);
    });
    return out;
  }

  /** Gasta 1 ponto: aprende nv1 ou sobe 1 nível (máx. 6). */
  spendTalentPoint(id: TalentId): boolean {
    if (this.talentPoints <= 0) return false;
    const def = getTalentDef(id);
    if (!def) return false;
    const cur = this.getTalentLevel(id);
    if (cur >= def.maxLevel) return false;
    this.talentPoints -= 1;
    this.talents[id] = cur + 1;
    return true;
  }

  canUpgradeTalent(id: TalentId): boolean {
    const def = getTalentDef(id);
    if (!def || this.talentPoints <= 0) return false;
    return this.getTalentLevel(id) < def.maxLevel;
  }
}
