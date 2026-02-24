/**
 * Rewards shop.
 *
 * Each reward:
 *  - id          unique string key
 *  - title       display name
 *  - description what you get
 *  - costXP      XP required to unlock
 */

export const REWARDS = [
  {
    id: 'coffee_break',
    title: 'Coffee Break ☕',
    description: 'Tómate un café bien merecido',
    costXP: 200,
  },
  {
    id: 'snack_time',
    title: 'Snack Time 🍪',
    description: 'Cómete un snack de tu elección',
    costXP: 300,
  },
  {
    id: 'short_walk',
    title: 'Paseo Corto 🚶',
    description: 'Sal a dar una vuelta de 10 minutos',
    costXP: 400,
  },
  {
    id: 'social_media',
    title: 'Redes Sociales 📱',
    description: '15 minutos de redes sociales sin culpa',
    costXP: 500,
  },
  {
    id: 'music_break',
    title: 'Music Break 🎵',
    description: 'Escucha tu canción favorita',
    costXP: 600,
  },
  {
    id: 'gaming_session',
    title: 'Gaming Session 🎮',
    description: '30 minutos de videojuegos',
    costXP: 800,
  },
  {
    id: 'movie_night',
    title: 'Movie Night 🎬',
    description: 'Una película completa, sin culpa',
    costXP: 1000,
  },
  {
    id: 'order_food',
    title: 'Pide comida 🍕',
    description: 'Pide tu comida favorita a domicilio',
    costXP: 1200,
  },
  {
    id: 'day_off',
    title: 'Día Libre 🏖️',
    description: 'Un día completo de descanso',
    costXP: 2000,
  },
  {
    id: 'epic_reward',
    title: 'Recompensa Épica 🏆',
    description: 'Define tu propia recompensa épica',
    costXP: 3000,
  },
]

/**
 * Returns rewards the player can afford but hasn't unlocked yet.
 * @param {number}   xp
 * @param {string[]} unlockedIds
 * @returns {typeof REWARDS}
 */
export function getAvailableRewards(xp, unlockedIds) {
  const unlockedSet = new Set(unlockedIds)
  return REWARDS.filter((r) => !unlockedSet.has(r.id) && xp >= r.costXP)
}

/**
 * Returns the reward object for a given id.
 * @param {string} id
 */
export function getReward(id) {
  return REWARDS.find((r) => r.id === id)
}
