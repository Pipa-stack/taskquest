/**
 * Character catalog for TaskQuest.
 *
 * Each character can be unlocked (purchased) with XP and then assigned to the
 * active team (max 3 slots). Characters are purely visual — no gameplay bonuses
 * in this version.
 *
 * Fields:
 *   id    – stable string identifier (used in unlockedCharacters / activeTeam arrays)
 *   emoji – displayed in character cards and team slots
 *   name  – display name
 *   cost  – XP required to unlock
 *   stage – evolution stage label shown in team slots
 */
export const CHARACTERS = [
  { id: 'warrior', emoji: '⚔️', name: 'Guerrero',  cost: 100,  stage: 'I', rarity: 'common'   },
  { id: 'mage',    emoji: '🧙', name: 'Mago',      cost: 200,  stage: 'I', rarity: 'uncommon' },
  { id: 'ranger',  emoji: '🏹', name: 'Arquero',   cost: 150,  stage: 'I', rarity: 'common'   },
  { id: 'healer',  emoji: '💊', name: 'Curandero', cost: 300,  stage: 'I', rarity: 'rare'     },
  { id: 'rogue',   emoji: '🗡️', name: 'Pícaro',    cost: 250,  stage: 'I', rarity: 'uncommon' },
  { id: 'paladin', emoji: '🛡️', name: 'Paladín',   cost: 400,  stage: 'I', rarity: 'epic'     },
]

/** Returns a character definition by id, or undefined. */
export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id)
}

/**
 * Applies the talent evolve discount to a coin-based evolution cost.
 *
 * discountedCost = ceil(baseCost * (1 - evolveDiscount)), minimum 1.
 *
 * @param {number} baseCost       – original coin cost before discount
 * @param {number} evolveDiscount – fraction discount from talent (0–0.4)
 * @returns {number} discounted cost (integer, min 1)
 */
export function applyEvolveDiscount(baseCost, evolveDiscount) {
  if (!evolveDiscount || evolveDiscount <= 0) return baseCost
  return Math.max(1, Math.ceil(baseCost * (1 - evolveDiscount)))
}
