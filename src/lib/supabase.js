import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Supabase client, or null if env vars are not configured.
 * When null, all sync operations are silently skipped.
 */
export const supabase = url && key ? createClient(url, key) : null
