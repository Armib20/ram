import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Member, Event } from '../types'

interface EventAttendanceWithEvent {
  id: string
  eventId: string
  memberId: string
  points: number
  createdAt: string
  event: Event
}

export default function MemberDashboard() {
  const [member, setMember] = useState<Member | null>(null)
  const [events, setEvents] = useState<EventAttendanceWithEvent[]>([])
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
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('computingId', computingId.toLowerCase())
        .single()

      if (memberError) throw memberError
      setMember(memberData)

      // Load events the member is marked for
      if (memberData) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('event_attendance')
          .select(`
            *,
            event:events(*)
          `)
          .eq('memberId', memberData.id)
          .order('createdAt', { ascending: false })

        if (attendanceError) throw attendanceError
        setEvents((attendanceData || []) as EventAttendanceWithEvent[])
      }
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

        <div className="mb-8">
          <div className="bg-[#0E396D] rounded-xl p-8 text-white shadow-lg hover:shadow-xl transition-shadow border-2 border-[#F0D64E] max-w-md">
            <div className="text-sm font-medium uppercase tracking-wider mb-2 opacity-90">
              Total Points
            </div>
            <div className="text-5xl font-bold">{member.totalPoints}</div>
          </div>
        </div>

        <div className="mb-8 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
          <div className="flex">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Although points are a contributing factor in clinic decisions, the decision-making process is holistic and points do not guarantee admission.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-[#0E396D]">Your Events</h3>
          </div>
          {events.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>You haven't been marked for any events yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((attendance) => (
                    <tr key={attendance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {attendance.event.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(attendance.event.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#0E396D]">
                        {attendance.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
