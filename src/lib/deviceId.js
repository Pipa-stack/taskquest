/**
 * Returns a stable device identifier persisted in localStorage.
 * Generated once using crypto.randomUUID() and reused on every call.
 * Key: "taskquest.deviceId"
 */
export function getDeviceId() {
  try {
    const key = 'taskquest.deviceId'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch (_) {
    // Fallback if localStorage is unavailable (e.g. privacy mode)
    return crypto.randomUUID()
  }
}
