/**
 * Character catalog for TaskQuest.
 *
 * Each character can be purchased with coins and assigned to the active team
 * (max 3 slots). Characters can evolve from Stage I to Stage II by spending
 * additional coins.
 *
 * Fields:
 *   id         – stable string identifier
 *   emoji      – displayed in character cards and team slots
 *   name       – display name (Spanish)
 *   rarity     – 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
 *   priceCoins – coins required to unlock
 *   shortLore  – brief lore description
 *
 * Evolution costs by rarity (Stage I → Stage II):
 *   common: 30  |  uncommon: 60  |  rare: 120  |  epic: 200  |  legendary: 300
 */

/** Cost (coins) to evolve a character by rarity. */
export const EVOLUTION_COSTS = {
  common: 30,
  uncommon: 60,
  rare: 120,
  epic: 200,
  legendary: 300,
}

export const CHARACTERS = [
  // ── Common ────────────────────────────────────────────────────────────
  {
    id: 'peasant',
    emoji: '🧑‍🌾',
    name: 'Campesino',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'Un trabajador humilde que sueña con aventuras.',
  },
  {
    id: 'apprentice',
    emoji: '📚',
    name: 'Aprendiz',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'Estudia cada noche a la luz de una vela.',
  },
  {
    id: 'scout',
    emoji: '🔭',
    name: 'Explorador',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'Conoce cada sendero del bosque.',
  },
  {
    id: 'fisherman',
    emoji: '🎣',
    name: 'Pescador',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'La paciencia es su mayor virtud.',
  },
  {
    id: 'herbalist',
    emoji: '🌿',
    name: 'Herbolario',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'Conoce el poder curativo de las plantas.',
  },
  {
    id: 'blacksmith',
    emoji: '🔨',
    name: 'Herrero',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'Forja sueños en cada golpe de martillo.',
  },
  {
    id: 'bard',
    emoji: '🎵',
    name: 'Bardo',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'Sus canciones llenan de valor a los aliados.',
  },
  {
    id: 'monk',
    emoji: '🧘',
    name: 'Monje',
    rarity: 'common',
    priceCoins: 50,
    shortLore: 'La serenidad es su armadura.',
  },

  // ── Uncommon ──────────────────────────────────────────────────────────
  {
    id: 'warrior',
    emoji: '⚔️',
    name: 'Guerrero',
    rarity: 'uncommon',
    priceCoins: 100,
    shortLore: 'Un soldado veterano con cicatrices de honor.',
  },
  {
    id: 'ranger',
    emoji: '🏹',
    name: 'Arquero',
    rarity: 'uncommon',
    priceCoins: 100,
    shortLore: 'Su flecha nunca yerra en la oscuridad.',
  },
  {
    id: 'rogue',
    emoji: '🗡️',
    name: 'Pícaro',
    rarity: 'uncommon',
    priceCoins: 100,
    shortLore: 'Sombra y astucia son sus mejores aliados.',
  },
  {
    id: 'alchemist',
    emoji: '⚗️',
    name: 'Alquimista',
    rarity: 'uncommon',
    priceCoins: 100,
    shortLore: 'Transforma el conocimiento en poder.',
  },
  {
    id: 'druid',
    emoji: '🍃',
    name: 'Druida',
    rarity: 'uncommon',
    priceCoins: 100,
    shortLore: 'Habla con el viento y los árboles.',
  },
  {
    id: 'berserker',
    emoji: '💢',
    name: 'Berserker',
    rarity: 'uncommon',
    priceCoins: 100,
    shortLore: 'El furor es su fuente de poder ilimitado.',
  },

  // ── Rare ──────────────────────────────────────────────────────────────
  {
    id: 'mage',
    emoji: '🧙',
    name: 'Mago',
    rarity: 'rare',
    priceCoins: 200,
    shortLore: 'Domina los arcanos con voluntad de hierro.',
  },
  {
    id: 'healer',
    emoji: '💊',
    name: 'Curandero',
    rarity: 'rare',
    priceCoins: 200,
    shortLore: 'Devuelve la esperanza donde otros ven ruinas.',
  },
  {
    id: 'necromancer',
    emoji: '💀',
    name: 'Nigromante',
    rarity: 'rare',
    priceCoins: 200,
    shortLore: 'Conoce los secretos que yacen más allá de la vida.',
  },
  {
    id: 'summoner',
    emoji: '🌀',
    name: 'Invocador',
    rarity: 'rare',
    priceCoins: 200,
    shortLore: 'Llama a seres de otros planos a su servicio.',
  },
  {
    id: 'elementalist',
    emoji: '🔥',
    name: 'Elementalista',
    rarity: 'rare',
    priceCoins: 200,
    shortLore: 'Controla fuego, agua, tierra y aire.',
  },

  // ── Epic ──────────────────────────────────────────────────────────────
  {
    id: 'paladin',
    emoji: '🛡️',
    name: 'Paladín',
    rarity: 'epic',
    priceCoins: 350,
    shortLore: 'Protector de los débiles, terror de los malvados.',
  },
  {
    id: 'archmage',
    emoji: '🔮',
    name: 'Archimago',
    rarity: 'epic',
    priceCoins: 350,
    shortLore: 'Ha doblado las leyes de la realidad a su voluntad.',
  },
  {
    id: 'shadow_knight',
    emoji: '🌑',
    name: 'Caballero Oscuro',
    rarity: 'epic',
    priceCoins: 350,
    shortLore: 'Camina entre la luz y las tinieblas.',
  },

  // ── Legendary ─────────────────────────────────────────────────────────
  {
    id: 'dragon_rider',
    emoji: '🐉',
    name: 'Jinete de Dragón',
    rarity: 'legendary',
    priceCoins: 500,
    shortLore: 'Forjó un vínculo eterno con el último dragón.',
  },
  {
    id: 'time_keeper',
    emoji: '⏳',
    name: 'Guardián del Tiempo',
    rarity: 'legendary',
    priceCoins: 500,
    shortLore: 'Conoce cada posibilidad del pasado y el futuro.',
  },
]

/** Returns a character definition by id, or undefined. */
export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id)
}

/**
 * Returns the evolution cost (coins) for a character, or 0 if not found.
 * @param {string} id - character id
 * @returns {number}
 */
export function getEvolutionCost(id) {
  const char = getCharacter(id)
  if (!char) return 0
  return EVOLUTION_COSTS[char.rarity] ?? 0
}
