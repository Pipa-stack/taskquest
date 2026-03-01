/**
 * Cosmetic skins catalog for TaskQuest.
 *
 * Skins are purely visual — they do NOT affect stats, power, idle earnings,
 * or any gameplay mechanic. Each character can have at most one equipped skin.
 *
 * Rarity pricing (fixed):
 *   common → 40 coins
 *   rare   → 80 coins
 *   epic   → 120 coins
 */

export const SKIN_PRICES = {
  common: 40,
  rare: 80,
  epic: 120,
}

export const SKINS = [
  // ── Common ────────────────────────────────────────────────────────────────
  {
    id: 'skin_autumn',
    title: 'Otoño Dorado',
    rarity: 'common',
    priceCoins: SKIN_PRICES.common,
    tags: ['nature', 'warm'],
  },
  {
    id: 'skin_frost',
    title: 'Escarcha',
    rarity: 'common',
    priceCoins: SKIN_PRICES.common,
    tags: ['ice', 'cool'],
  },
  {
    id: 'skin_shadow',
    title: 'Sombra Oscura',
    rarity: 'common',
    priceCoins: SKIN_PRICES.common,
    tags: ['dark', 'stealth'],
  },
  {
    id: 'skin_desert',
    title: 'Desierto',
    rarity: 'common',
    priceCoins: SKIN_PRICES.common,
    tags: ['earth', 'warm'],
  },

  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: 'skin_storm',
    title: 'Tormenta',
    rarity: 'rare',
    priceCoins: SKIN_PRICES.rare,
    tags: ['lightning', 'power'],
  },
  {
    id: 'skin_forest',
    title: 'Guardián del Bosque',
    rarity: 'rare',
    priceCoins: SKIN_PRICES.rare,
    tags: ['nature', 'green'],
  },
  {
    id: 'skin_ocean',
    title: 'Profundidades',
    rarity: 'rare',
    priceCoins: SKIN_PRICES.rare,
    tags: ['water', 'blue'],
  },
  {
    id: 'skin_inferno',
    title: 'Infierno',
    rarity: 'rare',
    priceCoins: SKIN_PRICES.rare,
    tags: ['fire', 'red'],
  },

  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    id: 'skin_celestial',
    title: 'Celestial',
    rarity: 'epic',
    priceCoins: SKIN_PRICES.epic,
    tags: ['light', 'gold'],
  },
  {
    id: 'skin_void',
    title: 'Vacío Cósmico',
    rarity: 'epic',
    priceCoins: SKIN_PRICES.epic,
    tags: ['space', 'purple'],
  },
  {
    id: 'skin_dragon',
    title: 'Escama de Dragón',
    rarity: 'epic',
    priceCoins: SKIN_PRICES.epic,
    tags: ['dragon', 'mythic'],
  },
  {
    id: 'skin_crystal',
    title: 'Cristal Arcano',
    rarity: 'epic',
    priceCoins: SKIN_PRICES.epic,
    tags: ['magic', 'gem'],
  },
]

/** Returns a skin definition by id, or undefined. */
export function getSkin(id) {
  return SKINS.find((s) => s.id === id)
}
