import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Member } from '../types'

interface Props {
  user: any
}

export default function MemberDashboard({ user }: Props) {
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      navigate('/login', { replace: true })
      return
    }

    // Redirect exec members to exec dashboard
    if (currentUser.isExec) {
      navigate('/exec', { replace: true })
      return
    }

    loadMemberData(currentUser.computingId)
  }, [navigate])

  const loadMemberData = async (computingId: string) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('computingId', computingId.toLowerCase())
        .single()

      if (error) throw error
      setMember(data)
    } catch (err) {
      console.error('Error loading member data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0E396D] rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error loading member data</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#0E396D]">RAM Points Tracker</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:border-[#0E396D] hover:text-[#0E396D] transition-colors"
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#0E396D] mb-2">Welcome, {member.name}!</h2>
          <p className="text-gray-600">@{member.computingId}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0E396D] rounded-xl p-8 text-white shadow-lg hover:shadow-xl transition-shadow border-2 border-[#F0D64E]">
            <div className="text-sm font-medium uppercase tracking-wider mb-2 opacity-90">
              Total Points
            </div>
            <div className="text-5xl font-bold">{member.totalPoints}</div>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-2">
              Spring 2025
            </div>
            <div className="text-5xl font-bold text-gray-900">{member.spring2025Total}</div>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wider mb-2">
              Fall 2025
            </div>
            <div className="text-5xl font-bold text-gray-900">{member.fall2025Total}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
          <p className="text-gray-600 text-center text-sm">
            Points are updated by exec members after events and activities.
          </p>
        </div>
      </main>
    </div>
  )
}
