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

export async function checkComputingIdExists(computingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('members')
    .select('computingId')
    .eq('computingId', computingId.toLowerCase())
    .maybeSingle()

  return !error && !!data
}

export async function createAccount(
  computingId: string,
  email: string,
  name: string,
  password: string
): Promise<Member | null> {
  // Check if computing ID already exists
  const exists = await checkComputingIdExists(computingId)
  if (exists) {
    return null
  }

  const { data, error } = await supabase
    .from('members')
    .insert([
      {
        computingId: computingId.toLowerCase(),
        email: email.toLowerCase(),
        name,
        password,
        isExec: false,
        totalPoints: 0,
        spring2025Total: 0,
        fall2025Total: 0,
      },
    ])
    .select()
    .single()

  if (error || !data) {
    return null
  }

  // Store user in sessionStorage
  sessionStorage.setItem('user', JSON.stringify(data))
  return data
}

export async function resetPassword(computingId: string, newPassword: string): Promise<boolean> {
  // Check if computing ID exists
  const exists = await checkComputingIdExists(computingId)
  if (!exists) {
    return false
  }

  const { error } = await supabase
    .from('members')
    .update({ password: newPassword })
    .eq('computingId', computingId.toLowerCase())

  return !error
}

