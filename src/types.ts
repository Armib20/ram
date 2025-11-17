export interface Member {
  id?: string
  name: string
  email: string
  computingId: string
  isExec: boolean
  totalPoints: number
  spring2025Total: number
  fall2025Total: number
  password?: string
  createdAt?: string
  updatedAt?: string
}

export interface Event {
  id?: string
  name: string
  date: string
  points: number
  createdAt?: string
}

export interface EventAttendance {
  id?: string
  eventId: string
  memberId: string
  points: number
  createdAt?: string
}

export interface LoginCredentials {
  computingId: string
  password: string
}

