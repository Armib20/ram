import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Member, Event } from '../types'
import * as XLSX from 'xlsx'

export default function ExecDashboard() {
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'events'>('members')
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [newEvent, setNewEvent] = useState({ name: '', date: '', points: 2 })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    computingId: '',
    email: '',
    password: '',
  })
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

    if (uploadFile) {
      setIsUploading(true)
    }

    try {
      // Create the event first
      const { data: createdEvent, error: eventError } = await supabase
        .from('events')
        .insert([newEvent])
        .select()
        .single()

      if (eventError) throw eventError

      // If a file was uploaded, process it and assign points
      if (uploadFile && createdEvent) {
        await processSpreadsheetForEvent(uploadFile, createdEvent.id!, newEvent.points, newEvent.date)
      }

      setNewEvent({ name: '', date: '', points: 2 })
      setUploadFile(null)
      await loadData()
      setActiveTab('events')
      alert(uploadFile ? 'Event created and spreadsheet processed successfully!' : 'Event created successfully!')
    } catch (err) {
      console.error('Error creating event:', err)
      alert('Failed to create event. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const processSpreadsheetForEvent = async (file: File, eventId: string, eventPoints: number, eventDate: string) => {
    try {
      let workbook: XLSX.WorkBook
      const fileName = file.name.toLowerCase()
      
      if (fileName.endsWith('.csv')) {
        // Handle CSV files as text
        const text = await file.text()
        workbook = XLSX.read(text, { type: 'string' })
      } else {
        // Handle Excel files (.xlsx, .xls) as binary
      const data = await file.arrayBuffer()
        workbook = XLSX.read(data)
      }
      
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      const isSpring2025 = new Date(eventDate) >= new Date('2025-01-01') && new Date(eventDate) < new Date('2025-06-01')

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

        let memberId: string
        let member: Member | null = null

        if (!existingMember) {
          // Create new member
          const { data: newMember, error: insertError } = await supabase
            .from('members')
            .insert([
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
            .select()
            .single()

          if (insertError) {
            console.error(`Error creating member ${name}:`, insertError)
            continue
          }

          memberId = newMember.id!
          member = newMember
        } else {
          memberId = existingMember.id!
          member = existingMember
        }

        // Check if attendance already exists
        const { data: existingAttendance } = await supabase
          .from('event_attendance')
          .select('*')
          .eq('eventId', eventId)
          .eq('memberId', memberId)
          .maybeSingle()

        if (!existingAttendance) {
          // Add attendance for this event
          const { error: attendanceError } = await supabase.from('event_attendance').insert([
            { eventId, memberId, points: eventPoints },
          ])

          if (attendanceError) {
            console.error(`Error adding attendance for ${name}:`, attendanceError)
            continue
          }
        } else {
          // Attendance already exists, skip to avoid duplicate points
          continue
        }

        // Update member points
        if (member) {
          const updates: any = {}
          if (isSpring2025) {
            updates.spring2025Total = (member.spring2025Total || 0) + eventPoints
          } else {
            updates.fall2025Total = (member.fall2025Total || 0) + eventPoints
          }
          updates.totalPoints = (member.totalPoints || 0) + eventPoints

          const { error: updateError } = await supabase.from('members').update(updates).eq('id', memberId)
          if (updateError) {
            console.error(`Error updating points for ${name}:`, updateError)
          }
        }
      }
    } catch (err) {
      console.error('Error processing spreadsheet:', err)
      throw err
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
    }
  }

  const handleDeleteMember = async (member: Member) => {
    if (!confirm(`Are you sure you want to delete ${member.name}? This action cannot be undone.`)) {
      return
    }

    setDeletingMemberId(member.id!)

    try {
      // Delete event attendance records first
      const { error: attendanceError } = await supabase
        .from('event_attendance')
        .delete()
        .eq('memberId', member.id!)

      if (attendanceError) {
        console.error('Error deleting attendance records:', attendanceError)
      }

      // Delete the member
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .eq('id', member.id!)

      if (deleteError) throw deleteError

      await loadData()
      alert('Member deleted successfully!')
    } catch (err) {
      console.error('Error deleting member:', err)
      alert('Failed to delete member. Please try again.')
    } finally {
      setDeletingMemberId(null)
    }
  }

  const handleDeleteEvent = async (event: Event) => {
    if (!confirm(`Are you sure you want to delete "${event.name}"? This will remove all points associated with this event from members. This action cannot be undone.`)) {
      return
    }

    setDeletingEventId(event.id!)

    try {
      // Get all attendance records for this event
      const { data: attendanceRecords, error: fetchError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('eventId', event.id!)

      if (fetchError) throw fetchError

      // Update member points by subtracting the points they received from this event
      if (attendanceRecords && attendanceRecords.length > 0) {
        const isSpring2025 = new Date(event.date) >= new Date('2025-01-01') && new Date(event.date) < new Date('2025-06-01')

        for (const attendance of attendanceRecords) {
          // Get the member to get current totals
          const { data: member } = await supabase
            .from('members')
            .select('*')
            .eq('id', attendance.memberId)
            .single()

          if (member) {
            const updates: any = {}
            if (isSpring2025) {
              updates.spring2025Total = Math.max(0, (member.spring2025Total || 0) - attendance.points)
            } else {
              updates.fall2025Total = Math.max(0, (member.fall2025Total || 0) - attendance.points)
            }
            updates.totalPoints = Math.max(0, (member.totalPoints || 0) - attendance.points)

            const { error: updateError } = await supabase
              .from('members')
              .update(updates)
              .eq('id', attendance.memberId)

            if (updateError) {
              console.error(`Error updating points for member ${attendance.memberId}:`, updateError)
            }
          }
        }
      }

      // Delete all attendance records for this event
      const { error: attendanceDeleteError } = await supabase
        .from('event_attendance')
        .delete()
        .eq('eventId', event.id!)

      if (attendanceDeleteError) throw attendanceDeleteError

      // Delete the event
      const { error: eventDeleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id!)

      if (eventDeleteError) throw eventDeleteError

      await loadData()
      alert('Event deleted successfully! All associated points have been removed from members.')
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event. Please try again.')
    } finally {
      setDeletingEventId(null)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMember.name.trim() || !newMember.computingId.trim() || !newMember.email.trim()) {
      alert('Please fill in all required fields')
      return
    }

    if (newMember.password && newMember.password.length < 8) {
      alert('Password must be at least 8 characters long')
      return
    }

    try {
      // Check if computing ID already exists
      const { data: existing } = await supabase
        .from('members')
        .select('computingId')
        .eq('computingId', newMember.computingId.toLowerCase())
        .maybeSingle()

      if (existing) {
        alert('A member with this computing ID already exists')
        return
      }

      const { error } = await supabase.from('members').insert([
        {
          name: newMember.name.trim(),
          computingId: newMember.computingId.toLowerCase(),
          email: newMember.email.toLowerCase(),
          password: newMember.password || null,
          isExec: false,
          totalPoints: 0,
          spring2025Total: 0,
          fall2025Total: 0,
        },
      ])

      if (error) throw error

      setNewMember({ name: '', computingId: '', email: '', password: '' })
      setShowAddMember(false)
      await loadData()
      alert('Member added successfully!')
    } catch (err) {
      console.error('Error adding member:', err)
      alert('Failed to add member. Please try again.')
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
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0E396D] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#0E396D]">RAM Exec Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:border-[#0E396D] hover:text-[#0E396D] transition-colors"
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
                ? 'text-[#0E396D] border-[#0E396D]'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-0.5 ${
              activeTab === 'events'
                ? 'text-[#0E396D] border-[#0E396D]'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
        </div>

        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="mb-6 flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search by name, computing ID, or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 max-w-md px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
              />
              <button
                onClick={() => setShowAddMember(true)}
                className="bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>+</span> Add Member
              </button>
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
                          <div className="flex gap-2">
                          <button
                            onClick={() => handleEditMember(member)}
                            disabled={deletingMemberId === member.id}
                              className="bg-[#0E396D] hover:bg-[#0A2D55] text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                            <button
                              onClick={() => handleDeleteMember(member)}
                              disabled={deletingMemberId === member.id}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {deletingMemberId === member.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Deleting...
                                </>
                              ) : (
                                'Delete'
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {showAddMember && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => {
                  setShowAddMember(false)
                  setNewMember({ name: '', computingId: '', email: '', password: '' })
                }}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Member</h2>
                  <form onSubmit={handleAddMember} className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={newMember.name}
                        onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Computing ID *
                      </label>
                      <input
                        type="text"
                        value={newMember.computingId}
                        onChange={(e) => setNewMember({ ...newMember, computingId: e.target.value.toLowerCase() })}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                        placeholder="Enter computing ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={newMember.email}
                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value.toLowerCase() })}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                        placeholder="Enter email"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={newMember.password}
                        onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                        minLength={8}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                        placeholder="Leave empty to use default password"
                      />
                      <p className="text-xs text-gray-500">If left empty, default password will be used</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                      >
                        Add Member
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMember(false)
                          setNewMember({ name: '', computingId: '', email: '', password: '' })
                        }}
                        className="flex-1 bg-transparent border-2 border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:border-[#0E396D] hover:text-[#0E396D] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveMember}
                        className="flex-1 bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMember(null)}
                        className="flex-1 bg-transparent border-2 border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:border-[#0E396D] hover:text-[#0E396D] transition-colors"
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
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
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
                          points: parseInt(e.target.value) || 2,
                        })
                      }
                      min="1"
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors"
                    />
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Upload Spreadsheet (Optional)
                  </label>
                  <p className="text-sm text-gray-500 mb-2">
                    Upload a spreadsheet with <strong>Name</strong> and <strong>Computing ID</strong> columns.
                    Members will be created automatically and assigned points for this event.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#0E396D] transition-colors"
                  />
                  {uploadFile && (
                    <p className="text-sm text-[#0E396D] mt-2">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="mt-4 bg-[#0E396D] hover:bg-[#0A2D55] text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing Spreadsheet...
                    </>
                  ) : uploadFile ? (
                    'Create Event & Process Spreadsheet'
                  ) : (
                    'Create Event'
                  )}
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
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {event.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-1">
                        {new Date(event.date).toLocaleDateString()}
                      </p>
                      <p className="text-[#0E396D] font-semibold">{event.points} points</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            const [memberId, points] = e.target.value.split(':')
                            handleAddAttendance(event.id!, memberId, parseInt(points))
                            e.target.value = ''
                          }
                        }}
                        className="w-full md:w-64 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0E396D] transition-colors cursor-pointer"
                      >
                        <option value="">Add attendance...</option>
                        {members.map((member) => (
                          <option key={member.id} value={`${member.id}:${event.points}`}>
                            {member.name} (+{event.points} points)
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDeleteEvent(event)}
                        disabled={deletingEventId === event.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {deletingEventId === event.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Deleting...
                          </>
                        ) : (
                          'Delete Event'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
