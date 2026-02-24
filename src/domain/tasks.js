import { getXpForDifficulty } from './gamification.js'

export const DIFFICULTIES = ['easy', 'medium', 'hard']

export const DIFFICULTY_LABELS = {
  easy:   'Fácil',
  medium: 'Media',
  hard:   'Difícil',
}

/**
 * Builds a plain task data object ready to be persisted.
 * ID is assigned by the DB layer.
 */
export const createTaskData = (title, difficulty = 'medium') => ({
  title:       title.trim(),
  difficulty,
  status:      'pending',
  xpReward:    getXpForDifficulty(difficulty),
  dueDate:     new Date().toISOString().split('T')[0],   // YYYY-MM-DD
  createdAt:   new Date().toISOString(),
  completedAt: null,
})
