import { supabase } from './supabase'
import { Member } from '../types'

const DEFAULT_PASSWORD = 'rampoints12!'

export async function login(computingId: string, password: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('computingId', computingId.toLowerCase())
    .single()

  if (error || !data) {
    return null
  }

  // Check password - if no password set, use default
  const storedPassword = data.password || DEFAULT_PASSWORD
  if (password !== storedPassword) {
    return null
  }

  // Store user in sessionStorage
  sessionStorage.setItem('user', JSON.stringify(data))
  return data
}

export async function updatePassword(computingId: string, newPassword: string): Promise<boolean> {
  const { error } = await supabase
    .from('members')
    .update({ password: newPassword })
    .eq('computingId', computingId.toLowerCase())

  return !error
}

export function getCurrentUser(): Member | null {
  const userStr = sessionStorage.getItem('user')
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function logout() {
  sessionStorage.removeItem('user')
  window.location.href = '/login'
}

