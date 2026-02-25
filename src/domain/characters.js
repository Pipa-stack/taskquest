/**
 * Character catalog for the TaskQuest shop.
 *
 * Characters are purely cosmetic collectibles — no gameplay bonuses.
 * Rarity distribution: 12 common, 8 rare, 3 epic, 1 legendary (24 total).
 *
 * Price ranges:
 *   common    50–80 coins
 *   rare      150–220 coins
 *   epic      400–550 coins
 *   legendary 1000 coins
 */

export const CHARACTER_CATALOG = [
  // ── COMMON (12) ──────────────────────────────────────────────────────────
  {
    id: 'guerrero_novato',
    name: 'Guerrero Novato',
    rarity: 'common',
    priceCoins: 50,
    emoji: '⚔️',
    shortLore: 'Un joven soldado que recién empieza su aventura.',
  },
  {
    id: 'aldeana_valiente',
    name: 'Aldeana Valiente',
    rarity: 'common',
    priceCoins: 55,
    emoji: '👒',
    shortLore: 'Defiende su pueblo con una azada y mucho coraje.',
  },
  {
    id: 'aprendiz_mago',
    name: 'Aprendiz de Mago',
    rarity: 'common',
    priceCoins: 60,
    emoji: '🪄',
    shortLore: 'Lleva semanas practicando el hechizo de la luz.',
  },
  {
    id: 'arquero_bosque',
    name: 'Arquero del Bosque',
    rarity: 'common',
    priceCoins: 60,
    emoji: '🏹',
    shortLore: 'Nunca falla un blanco entre los árboles.',
  },
  {
    id: 'cocinero_aventurero',
    name: 'Cocinero Aventurero',
    rarity: 'common',
    priceCoins: 50,
    emoji: '🍳',
    shortLore: 'Su estofado de dragón es legendario en la taberna.',
  },
  {
    id: 'bardo_errante',
    name: 'Bardo Errante',
    rarity: 'common',
    priceCoins: 65,
    emoji: '🎶',
    shortLore: 'Sus canciones suben la moral de cualquier grupo.',
  },
  {
    id: 'monje_montaña',
    name: 'Monje de la Montaña',
    rarity: 'common',
    priceCoins: 70,
    emoji: '🧘',
    shortLore: 'Medita al amanecer para alcanzar la paz interior.',
  },
  {
    id: 'pirata_jubilado',
    name: 'Pirata Jubilado',
    rarity: 'common',
    priceCoins: 55,
    emoji: '🏴‍☠️',
    shortLore: 'Cambió el mar por la granja, pero guarda el sable.',
  },
  {
    id: 'herrero_orgulloso',
    name: 'Herrero Orgulloso',
    rarity: 'common',
    priceCoins: 70,
    emoji: '🔨',
    shortLore: 'Forja espadas que duran generaciones.',
  },
  {
    id: 'exploradora_desierto',
    name: 'Exploradora del Desierto',
    rarity: 'common',
    priceCoins: 75,
    emoji: '🐪',
    shortLore: 'Ha cruzado tres desiertos sin mapa ni brújula.',
  },
  {
    id: 'brujo_pantano',
    name: 'Brujo del Pantano',
    rarity: 'common',
    priceCoins: 80,
    emoji: '🐸',
    shortLore: 'Mezcla pociones raras con plantas del lodazal.',
  },
  {
    id: 'caballero_oxidado',
    name: 'Caballero Oxidado',
    rarity: 'common',
    priceCoins: 65,
    emoji: '🛡️',
    shortLore: 'Su armadura cruje, pero su honor brilla.',
  },

  // ── RARE (8) ─────────────────────────────────────────────────────────────
  {
    id: 'cazadora_sombras',
    name: 'Cazadora de Sombras',
    rarity: 'rare',
    priceCoins: 150,
    emoji: '🌙',
    shortLore: 'Rastrea criaturas de la oscuridad desde hace décadas.',
  },
  {
    id: 'golem_arcano',
    name: 'Gólem Arcano',
    rarity: 'rare',
    priceCoins: 160,
    emoji: '🗿',
    shortLore: 'Construido por un mago olvidado, busca su propósito.',
  },
  {
    id: 'elfa_viento',
    name: 'Elfa del Viento',
    rarity: 'rare',
    priceCoins: 175,
    emoji: '🌿',
    shortLore: 'Domina los vientos con una elegancia sobrenatural.',
  },
  {
    id: 'piromante_rebelde',
    name: 'Piromante Rebelde',
    rarity: 'rare',
    priceCoins: 180,
    emoji: '🔥',
    shortLore: 'Expulsado de la academia por incendiar demasiado.',
  },
  {
    id: 'mercenario_hielo',
    name: 'Mercenario del Hielo',
    rarity: 'rare',
    priceCoins: 200,
    emoji: '❄️',
    shortLore: 'Solo acepta contratos en tierras congeladas.',
  },
  {
    id: 'hechicera_luna',
    name: 'Hechicera Lunar',
    rarity: 'rare',
    priceCoins: 210,
    emoji: '🌕',
    shortLore: 'Sus poderes alcanzan su cúspide en luna llena.',
  },
  {
    id: 'alquimista_loco',
    name: 'Alquimista Loco',
    rarity: 'rare',
    priceCoins: 185,
    emoji: '⚗️',
    shortLore: 'Inventó dieciséis pociones de invisibilidad en un día.',
  },
  {
    id: 'samurai_honroso',
    name: 'Samurái Honoroso',
    rarity: 'rare',
    priceCoins: 220,
    emoji: '⛩️',
    shortLore: 'Viajó al oeste buscando un duelo digno de su espada.',
  },

  // ── EPIC (3) ─────────────────────────────────────────────────────────────
  {
    id: 'dragon_guardian',
    name: 'Dragón Guardián',
    rarity: 'epic',
    priceCoins: 400,
    emoji: '🐉',
    shortLore: 'Protege los antiguos archivos del reino desde el alba de los tiempos.',
  },
  {
    id: 'liche_sabia',
    name: 'Liche Sabia',
    rarity: 'epic',
    priceCoins: 500,
    emoji: '💀',
    shortLore: 'Sacrificó su mortalidad por conocimiento infinito.',
  },
  {
    id: 'titan_tormenta',
    name: 'Titán de la Tormenta',
    rarity: 'epic',
    priceCoins: 550,
    emoji: '⚡',
    shortLore: 'Cada pisada suya desencadena una tormenta eléctrica.',
  },

  // ── LEGENDARY (1) ────────────────────────────────────────────────────────
  {
    id: 'oraculo_eterno',
    name: 'Oráculo Eterno',
    rarity: 'legendary',
    priceCoins: 1000,
    emoji: '🌟',
    shortLore: 'Existe antes que los dioses. Conoce el inicio y el fin de toda historia.',
  },
]

/**
 * Lookup a character by id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getCharacter(id) {
  return CHARACTER_CATALOG.find((c) => c.id === id)
}
