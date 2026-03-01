import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CHARACTERS } from '../domain/characters.js'
import { SKINS, getSkin } from '../domain/skins.js'
import { playerRepository } from '../repositories/playerRepository.js'
import EvolveModal from './EvolveModal.jsx'

// ── Constants ──────────────────────────────────────────────────────────────

const RARITY_LABEL = {
  common:    'Común',
  uncommon:  'Poco común',
  rare:      'Raro',
  epic:      'Épico',
  legendary: 'Legendario',
}

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common']

const STAGE_LABELS = { I: 'Stage I', II: 'Stage II', III: 'Stage III' }
const STAGE_ORDER  = ['I', 'II', 'III']

const LORE = {
  warrior: 'Veterano de mil batallas. Su espada nunca ha conocido la derrota.',
  mage:    'Domina los arcanos primordiales. Cada hechizo reescribe la realidad.',
  ranger:  'Ojos de halcón, puntería perfecta. El bosque es su aliado eterno.',
  healer:  'Donde otros ven heridas, él ve oportunidades de vida.',
  rogue:   'Las sombras son su hogar. Nadie lo ve hasta que ya es tarde.',
  paladin: 'Su fe es su escudo. La justicia, su espada más afilada.',
}

// Evolución en coins: stage I → II = 150, II → III = 300
const EVOLVE_COST = { I: 150, II: 300 }

function nextStage(current) {
  const idx = STAGE_ORDER.indexOf(current)
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null
}

// ── Progress helpers ───────────────────────────────────────────────────────

function buildProgress(unlockedSet) {
  const total = CHARACTERS.length
  const unlocked = CHARACTERS.filter((c) => unlockedSet.has(c.id)).length

  const byRarity = {}
  for (const r of RARITY_ORDER) {
    const chars = CHARACTERS.filter((c) => c.rarity === r)
    if (!chars.length) continue
    byRarity[r] = {
      total:    chars.length,
      unlocked: chars.filter((c) => unlockedSet.has(c.id)).length,
    }
  }

  return { total, unlocked, byRarity }
}

// ── Sorted character list (unlocked first) ─────────────────────────────────

function sortedCharacters(unlockedSet) {
  return [...CHARACTERS].sort((a, b) => {
    const aU = unlockedSet.has(a.id) ? 0 : 1
    const bU = unlockedSet.has(b.id) ? 0 : 1
    if (aU !== bU) return aU - bU
    // Within same group: sort by rarity tier
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  })
}

// ── Skin rarity colour helper ──────────────────────────────────────────────

function skinRarityClass(rarity) {
  return `skin-tag skin-tag--${rarity}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-component: Character Detail Modal
// ═══════════════════════════════════════════════════════════════════════════

function CharDetailModal({
  char,
  isUnlocked,
  player,
  onClose,
  onNotify,
}) {
  const [tab, setTab] = useState('info')
  const [showEvolve, setShowEvolve] = useState(false)

  const { coins = 0, unlockedSkins = [], equippedSkinByCharId = {} } = player
  const equippedSkin = equippedSkinByCharId[char.id]
  const targetStage  = nextStage(char.stage)
  const evolveCost   = EVOLVE_COST[char.stage] ?? null

  const handleEvolveConfirm = async () => {
    // evolveCharacter is not yet in the repo; we use buyBoost pattern as placeholder
    // and rely on the existing domain (no combat stats changed)
    // For now, just deduct coins as a stub — in production wire to a real evolve method
    if (!evolveCost || coins < evolveCost) return false
    // Placeholder: deduct coins via a raw put (no dedicated method yet)
    // In a full implementation this would call playerRepository.evolveCharacter(char.id)
    return false // Not yet implemented — button disabled when no method exists
  }

  const handleBuySkin = async (skinId) => {
    const ok = await playerRepository.buySkin(skinId)
    if (ok) {
      const skin = getSkin(skinId)
      onNotify?.(`¡Skin "${skin?.title}" desbloqueada! 🎨`)
    } else {
      onNotify?.('No puedes comprar esta skin (monedas insuficientes o ya la tienes)')
    }
  }

  const handleEquipSkin = async (skinId) => {
    const ok = await playerRepository.equipSkin(char.id, skinId)
    if (ok) {
      const skin = getSkin(skinId)
      onNotify?.(`Skin "${skin?.title}" equipada en ${char.name}`)
    }
  }

  return (
    <div className="pdx-modal-overlay" role="dialog" aria-modal="true" aria-label={`Detalle de ${char.name}`}>
      <div className="pdx-modal-backdrop" onClick={onClose} />

      <motion.div
        className="pdx-modal-panel card"
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        {/* Close button */}
        <button className="pdx-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>

        {/* Character header */}
        <div className={`pdx-modal-header character-frame frame-${char.rarity} ${!isUnlocked ? 'frame-locked' : ''}`}>
          <div className="pdx-modal-emoji">
            {isUnlocked ? char.emoji : <span className="pdx-silhouette">{char.emoji}</span>}
          </div>
          <div className="pdx-modal-meta">
            <h2 className="pdx-modal-name">{isUnlocked ? char.name : '???'}</h2>
            <span className={`badge pdx-rarity-chip rarity-chip--${char.rarity}`}>
              {RARITY_LABEL[char.rarity] ?? char.rarity}
            </span>
            <span className="pdx-stage-badge">
              {STAGE_LABELS[char.stage] ?? char.stage}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="pdx-tabs" role="tablist">
          {['info', 'skins'].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`pdx-tab-btn ${tab === t ? 'pdx-tab-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'info' ? 'Info' : 'Skins'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pdx-tab-content">
          <AnimatePresence mode="wait">
            {tab === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="pdx-info-tab"
              >
                {isUnlocked ? (
                  <>
                    <p className="pdx-lore">{LORE[char.id] ?? 'Un misterioso personaje.'}</p>

                    {targetStage && evolveCost && (
                      <div className="pdx-evolve-section">
                        <button
                          className="btn btn-primary pdx-evolve-btn"
                          onClick={() => setShowEvolve(true)}
                          disabled={coins < evolveCost}
                          title={coins < evolveCost ? `Necesitas ${evolveCost} 🪙` : undefined}
                        >
                          Evolucionar → {STAGE_LABELS[targetStage]}
                          <span className="pdx-evolve-cost">🪙 {evolveCost}</span>
                        </button>
                        {coins < evolveCost && (
                          <p className="pdx-evolve-hint">
                            Te faltan {evolveCost - coins} 🪙
                          </p>
                        )}
                      </div>
                    )}

                    {!targetStage && (
                      <p className="pdx-max-stage">Evolución máxima alcanzada ✦</p>
                    )}
                  </>
                ) : (
                  <p className="pdx-locked-hint">🔒 Desbloquea este personaje para ver su historia.</p>
                )}
              </motion.div>
            )}

            {tab === 'skins' && (
              <motion.div
                key="skins"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="pdx-skins-tab"
              >
                {!isUnlocked ? (
                  <p className="pdx-locked-hint">🔒 Desbloquea este personaje para equipar skins.</p>
                ) : (
                  <ul className="pdx-skin-list">
                    {SKINS.map((skin) => {
                      const owned    = unlockedSkins.includes(skin.id)
                      const equipped = equippedSkin === skin.id
                      return (
                        <li
                          key={skin.id}
                          className={`pdx-skin-item ${equipped ? 'pdx-skin-item--equipped' : ''}`}
                        >
                          <div className="pdx-skin-info">
                            <span className="pdx-skin-title">{skin.title}</span>
                            <span className={skinRarityClass(skin.rarity)}>
                              {RARITY_LABEL[skin.rarity] ?? skin.rarity}
                            </span>
                          </div>
                          <div className="pdx-skin-actions">
                            {equipped && (
                              <span className="pdx-skin-equipped-badge">Equipada ✓</span>
                            )}
                            {!owned && (
                              <button
                                className="btn btn-ghost pdx-skin-btn"
                                onClick={() => handleBuySkin(skin.id)}
                                disabled={coins < skin.priceCoins}
                                title={`🪙 ${skin.priceCoins}`}
                              >
                                Comprar 🪙{skin.priceCoins}
                              </button>
                            )}
                            {owned && !equipped && (
                              <button
                                className="btn btn-primary pdx-skin-btn"
                                onClick={() => handleEquipSkin(skin.id)}
                              >
                                Equipar
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Evolve confirm modal */}
      <AnimatePresence>
        {showEvolve && (
          <EvolveModal
            character={char}
            cost={evolveCost ?? 0}
            coins={coins}
            onConfirm={handleEvolveConfirm}
            onClose={() => setShowEvolve(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Pokédex component
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pokédex — bestiario de personajes con vista detalle, evolución y skins.
 *
 * Props:
 *   player           – player object from usePlayer()
 *   unlockedCharacters – string[]
 *   onNotify         – (msg: string) => void
 */
export default function Pokedex({ player, unlockedCharacters = [], onNotify }) {
  const [selected, setSelected] = useState(null)

  const unlockedSet = new Set(unlockedCharacters)
  const progress    = buildProgress(unlockedSet)
  const sorted      = sortedCharacters(unlockedSet)

  const selectedChar = selected ? CHARACTERS.find((c) => c.id === selected) : null

  return (
    <div className="pokedex">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="pdx-header">
        <h2 className="pdx-title">Pokédex</h2>

        <div className="pdx-progress-block">
          <span className="pdx-progress-total">
            {progress.unlocked} / {progress.total}
          </span>

          <div className="pdx-rarity-progress">
            {RARITY_ORDER.filter((r) => progress.byRarity[r]).map((r) => {
              const { unlocked, total } = progress.byRarity[r]
              return (
                <div key={r} className="pdx-rarity-row">
                  <span className={`pdx-rarity-label rarity-label--${r}`}>
                    {RARITY_LABEL[r]}
                  </span>
                  <span className="pdx-rarity-count">{unlocked}/{total}</span>
                  <div className="progress-wrap pdx-rarity-bar">
                    <div
                      className={`progress-fill pdx-rarity-fill--${r}`}
                      style={{ width: `${(unlocked / total) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="pdx-grid">
        {sorted.map((char) => {
          const isUnlocked = unlockedSet.has(char.id)
          return (
            <motion.button
              key={char.id}
              className={`pdx-card character-frame frame-${char.rarity} ${!isUnlocked ? 'pdx-card--locked' : 'pdx-card--unlocked'}`}
              onClick={() => setSelected(char.id)}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.97 }}
              aria-label={isUnlocked ? char.name : 'Personaje bloqueado'}
            >
              <div className="pdx-card-emoji">
                {isUnlocked
                  ? char.emoji
                  : <span className="pdx-card-silhouette">{char.emoji}</span>
                }
              </div>

              {!isUnlocked && (
                <span className="pdx-lock-badge" aria-label="Bloqueado">🔒</span>
              )}

              <div className="pdx-card-footer">
                <span className="pdx-card-name">
                  {isUnlocked ? char.name : '???'}
                </span>
                <span className={`badge pdx-rarity-chip rarity-chip--${char.rarity}`}>
                  {RARITY_LABEL[char.rarity] ?? char.rarity}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* ── Detail Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedChar && (
          <CharDetailModal
            key={selectedChar.id}
            char={selectedChar}
            isUnlocked={unlockedSet.has(selectedChar.id)}
            player={player}
            onClose={() => setSelected(null)}
            onNotify={onNotify}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
