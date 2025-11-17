import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Member, Event } from '../types'
import * as XLSX from 'xlsx'

interface Props {
  user: any
}

export default function ExecDashboard({ user }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'events' | 'upload'>('members')
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [newEvent, setNewEvent] = useState({ name: '', date: '', points: 1 })
  const navigate = useNavigate()

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || !currentUser.isExec) {
      navigate('/login', { replace: true })
      return
    }

    loadData()
  }, [navigate])

  const loadData = async () => {
    try {
      const [membersRes, eventsRes] = await Promise.all([
        supabase.from('members').select('*').order('name'),
        supabase.from('events').select('*').order('date', { ascending: false }),
      ])

      if (membersRes.error) throw membersRes.error
      if (eventsRes.error) throw eventsRes.error

      setMembers(membersRes.data || [])
      setEvents(eventsRes.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.computingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleEditMember = (member: Member) => {
    setEditingMember({ ...member })
  }

  const handleSaveMember = async () => {
    if (!editingMember) return

    try {
      const { error } = await supabase
        .from('members')
        .update({
          totalPoints: editingMember.totalPoints,
          spring2025Total: editingMember.spring2025Total,
          fall2025Total: editingMember.fall2025Total,
        })
        .eq('id', editingMember.id)

      if (error) throw error

      await loadData()
      setEditingMember(null)
    } catch (err) {
      console.error('Error updating member:', err)
      alert('Failed to update member. Please try again.')
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { error } = await supabase.from('events').insert([newEvent])

      if (error) throw error

      setNewEvent({ name: '', date: '', points: 1 })
      await loadData()
      setActiveTab('events')
    } catch (err) {
      console.error('Error creating event:', err)
      alert('Failed to create event. Please try again.')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      // Process each row
      for (const row of jsonData) {
        const name = row['Name'] || row['name']
        const computingId = (row['Computing ID'] || row['computingId'] || row['ComputingId'] || '').toLowerCase()

        if (!name || !computingId) continue

        // Check if member exists
        const { data: existingMember } = await supabase
          .from('members')
          .select('*')
          .eq('computingId', computingId)
          .maybeSingle()

        if (!existingMember) {
          // Create new member
          const { error: insertError } = await supabase.from('members').insert([
            {
              name,
              computingId,
              email: `${computingId}@virginia.edu`,
              isExec: false,
              totalPoints: 0,
              spring2025Total: 0,
              fall2025Total: 0,
            },
          ])

          if (insertError) {
            console.error(`Error creating member ${name}:`, insertError)
          }
        }
      }

      await loadData()
      alert('Spreadsheet processed successfully!')
      e.target.value = ''
    } catch (err) {
      console.error('Error processing spreadsheet:', err)
      alert('Failed to process spreadsheet. Please check the format.')
    }
  }

  const handleAddAttendance = async (eventId: string, memberId: string, points: number) => {
    try {
      // Check if attendance already exists
      const { data: existing, error: checkError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('eventId', eventId)
        .eq('memberId', memberId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      const oldPoints = existing?.points || 0
      const pointsDifference = points - oldPoints

      if (existing) {
        // Update existing attendance
        const { error: updateError } = await supabase
          .from('event_attendance')
          .update({ points })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else {
        // Create new attendance
        const { error: insertError } = await supabase.from('event_attendance').insert([
          { eventId, memberId, points },
        ])

        if (insertError) throw insertError
      }

      // Only update member totals if points changed
      if (pointsDifference !== 0) {
        const member = members.find((m) => m.id === memberId)
        if (member) {
          const event = events.find((e) => e.id === eventId)
          const isSpring2025 = event && new Date(event.date) >= new Date('2025-01-01') && new Date(event.date) < new Date('2025-06-01')
          
          const updates: any = {}
          if (isSpring2025) {
            updates.spring2025Total = Math.max(0, (member.spring2025Total || 0) + pointsDifference)
          } else {
            updates.fall2025Total = Math.max(0, (member.fall2025Total || 0) + pointsDifference)
          }
          updates.totalPoints = Math.max(0, (member.totalPoints || 0) + pointsDifference)

          const { error: updateError } = await supabase.from('members').update(updates).eq('id', memberId)
          if (updateError) throw updateError
        }
      }

      await loadData()
    } catch (err) {
      console.error('Error adding attendance:', err)
      alert('Failed to add attendance. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">RAM Exec Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:border-indigo-500 hover:text-indigo-600 transition-colors"
          >
            Log Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8 border-b-2 border-gray-200">
          <button
            className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-0.5 ${
              activeTab === 'members'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-0.5 ${
              activeTab === 'events'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-0.5 ${
              activeTab === 'upload'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            Upload Spreadsheet
          </button>
        </div>

        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by name, computing ID, or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Computing ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Total Points
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Spring 2025
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Fall 2025
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {member.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          @{member.computingId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {member.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                          {member.totalPoints}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {member.spring2025Total}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {member.fall2025Total}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEditMember(member)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editingMember && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => setEditingMember(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Edit Points for {editingMember.name}
                  </h2>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Total Points
                      </label>
                      <input
                        type="number"
                        value={editingMember.totalPoints}
                        onChange={(e) =>
                          setEditingMember({
                            ...editingMember,
                            totalPoints: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Spring 2025
                      </label>
                      <input
                        type="number"
                        value={editingMember.spring2025Total}
                        onChange={(e) =>
                          setEditingMember({
                            ...editingMember,
                            spring2025Total: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Fall 2025
                      </label>
                      <input
                        type="number"
                        value={editingMember.fall2025Total}
                        onChange={(e) =>
                          setEditingMember({
                            ...editingMember,
                            fall2025Total: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveMember}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="flex-1 bg-transparent border-2 border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Event</h2>
              <form onSubmit={handleCreateEvent}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Event Name</label>
                    <input
                      type="text"
                      value={newEvent.name}
                      onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Points</label>
                    <input
                      type="number"
                      value={newEvent.points}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          points: parseInt(e.target.value) || 1,
                        })
                      }
                      min="1"
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Create Event
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Events</h2>
              <div className="space-y-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {event.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-1">
                        {new Date(event.date).toLocaleDateString()}
                      </p>
                      <p className="text-indigo-600 font-semibold">{event.points} points</p>
                    </div>
                    <div className="w-full md:w-auto">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            const [memberId, points] = e.target.value.split(':')
                            handleAddAttendance(event.id!, memberId, parseInt(points))
                            e.target.value = ''
                          }
                        }}
                        className="w-full md:w-64 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        <option value="">Add attendance...</option>
                        {members.map((member) => (
                          <option key={member.id} value={`${member.id}:${event.points}`}>
                            {member.name} (+{event.points} points)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="flex justify-center">
            <div className="bg-white rounded-xl shadow-md p-12 max-w-2xl w-full text-center border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Spreadsheet</h2>
              <p className="text-gray-600 mb-2">
                Upload a spreadsheet with columns: <strong>Name</strong> and{' '}
                <strong>Computing ID</strong>
              </p>
              <p className="text-gray-500 text-sm mb-8 italic">
                New members will be created automatically if their computing ID doesn't exist.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
