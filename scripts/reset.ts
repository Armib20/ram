import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function resetDatabase() {
  try {
    console.log('🔄 Resetting database...\n')

    // Delete in order to respect foreign key constraints
    // event_attendance has foreign keys to both events and members

    // Get all records first, then delete them
    // This is necessary because Supabase doesn't support DELETE without a WHERE clause via the client
    
    console.log('Deleting event attendance records...')
    const { data: attendanceData } = await supabase.from('event_attendance').select('id')
    if (attendanceData && attendanceData.length > 0) {
      const { error: attendanceError } = await supabase
        .from('event_attendance')
        .delete()
        .in('id', attendanceData.map((r) => r.id))

      if (attendanceError) {
        console.error('Error deleting attendance records:', attendanceError)
        process.exit(1)
      }
      console.log(`✅ Deleted ${attendanceData.length} event attendance records\n`)
    } else {
      console.log('✅ No attendance records to delete\n')
    }

    console.log('Deleting events...')
    const { data: eventsData } = await supabase.from('events').select('id')
    if (eventsData && eventsData.length > 0) {
      const { error: eventsError } = await supabase
        .from('events')
        .delete()
        .in('id', eventsData.map((r) => r.id))

      if (eventsError) {
        console.error('Error deleting events:', eventsError)
        process.exit(1)
      }
      console.log(`✅ Deleted ${eventsData.length} events\n`)
    } else {
      console.log('✅ No events to delete\n')
    }

    console.log('Deleting members...')
    const { data: membersData } = await supabase.from('members').select('id')
    if (membersData && membersData.length > 0) {
      const { error: membersError } = await supabase
        .from('members')
        .delete()
        .in('id', membersData.map((r) => r.id))

      if (membersError) {
        console.error('Error deleting members:', membersError)
        process.exit(1)
      }
      console.log(`✅ Deleted ${membersData.length} members\n`)
    } else {
      console.log('✅ No members to delete\n')
    }

    // Verify tables are empty
    const [membersRes, eventsRes, attendanceRes] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('event_attendance').select('id', { count: 'exact', head: true }),
    ])

    console.log('📊 Verification:')
    console.log(`   Members: ${membersRes.count || 0}`)
    console.log(`   Events: ${eventsRes.count || 0}`)
    console.log(`   Attendance Records: ${attendanceRes.count || 0}`)

    console.log('\n✅ Database reset completed successfully!')
    console.log('   You can now run `pnpm seed` to populate the database again.')
  } catch (error) {
    console.error('Error resetting database:', error)
    process.exit(1)
  }
}

resetDatabase()

