import { useState } from 'react'

/**
 * Form to create a new task for today.
 * @param {{ onAdd: (title: string) => Promise<void> }} props
 */
export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onAdd(trimmed)
      setTitle('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        className="task-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task for today…"
        disabled={busy}
        aria-label="New task title"
      />
      <button
        className="btn-add"
        type="submit"
        disabled={!title.trim() || busy}
      >
        {busy ? 'Adding…' : '+ Add'}
      </button>
    </form>
  )
}
