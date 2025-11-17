import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Load environment variables
config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
// Support both VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface MemberData {
  name: string
  email: string
  computingId: string
  isExec: boolean
  totalPoints: number
  spring2025Total: number
  fall2025Total: number
  humpbackHike: number
  septemberGBM: number
  dues_notes: string
}

// Event configuration - map event field names to event details
const EVENT_CONFIG: Record<string, { name: string; date: string; points: number }> = {
  humpbackHike: {
    name: 'Humpback Hike',
    date: '2024-09-15', // Fall 2024 - adjust as needed
    points: 2, // Base points per attendance
  },
  septemberGBM: {
    name: 'September GBM',
    date: '2024-09-01', // Fall 2024 - adjust as needed
    points: 2, // Base points per attendance
  },
}

async function seedDatabase() {
  try {
    // Read members.json
    const membersPath = path.join(__dirname, '../data/members.json')
    const membersData: MemberData[] = JSON.parse(
      fs.readFileSync(membersPath, 'utf-8')
    )

    console.log(`Found ${membersData.length} members to seed`)

    // Step 1: Create events
    console.log('\nCreating events...')
    const eventMap: Record<string, string> = {} // eventField -> eventId

    for (const [eventField, eventConfig] of Object.entries(EVENT_CONFIG)) {
      // Check if event already exists
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('name', eventConfig.name)
        .maybeSingle()

      if (existingEvent) {
        console.log(`  Event "${eventConfig.name}" already exists`)
        eventMap[eventField] = existingEvent.id!
      } else {
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert([eventConfig])
          .select()
          .single()

        if (eventError) {
          console.error(`Error creating event "${eventConfig.name}":`, eventError)
          process.exit(1)
        }

        console.log(`  Created event: "${eventConfig.name}" (${eventConfig.date})`)
        eventMap[eventField] = newEvent.id!
      }
    }

    // Step 2: Insert members (with 0 points initially)
    console.log('\nInserting members...')
    const membersToInsert = membersData.map((member) => ({
      name: member.name,
      email: member.email,
      computingId: member.computingId.toLowerCase(),
      isExec: member.isExec,
      totalPoints: 0,
      spring2025Total: 0,
      fall2025Total: 0,
      // Don't set password - will use default on first login
    }))

    const batchSize = 50
    let totalInserted = 0
    const memberIdMap: Record<string, string> = {} // computingId -> memberId

    for (let i = 0; i < membersToInsert.length; i += batchSize) {
      const batch = membersToInsert.slice(i, i + batchSize)
      console.log(`  Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} members)...`)

      const { data, error } = await supabase
        .from('members')
        .upsert(batch, {
          onConflict: 'computingId',
          ignoreDuplicates: false,
        })
        .select()

      if (error) {
        console.error('Error seeding members:', error)
        console.error('Failed at batch starting at index:', i)
        process.exit(1)
      }

      // Map computingId to memberId
      if (data) {
        for (const member of data) {
          memberIdMap[member.computingId] = member.id!
        }
      }

      totalInserted += data?.length || 0
    }

    console.log(`  Successfully inserted/updated ${totalInserted} members`)

    // Step 3: Create event attendance records and calculate points
    console.log('\nCreating event attendance records...')
    const attendanceRecords: Array<{ eventId: string; memberId: string; points: number }> = []
    const memberPoints: Record<string, { total: number; spring: number; fall: number }> = {}

    // Initialize member points tracking
    for (const member of membersData) {
      const computingId = member.computingId.toLowerCase()
      memberPoints[computingId] = { total: 0, spring: 0, fall: 0 }
    }

    // Process each event field
    for (const [eventField, eventId] of Object.entries(eventMap)) {
      const eventConfig = EVENT_CONFIG[eventField]
      const eventDate = new Date(eventConfig.date)
      const isSpring2025 = eventDate >= new Date('2025-01-01') && eventDate < new Date('2025-06-01')
      const isFall2025 = eventDate >= new Date('2025-08-01') && eventDate < new Date('2026-01-01')

      for (const member of membersData) {
        const computingId = member.computingId.toLowerCase()
        const memberId = memberIdMap[computingId]
        const points = (member as any)[eventField] as number

        if (!memberId) {
          console.warn(`  Warning: Member ${member.name} (${computingId}) not found in database`)
          continue
        }

        if (points > 0) {
          // Create attendance record - the value in JSON represents total points for this event
          attendanceRecords.push({
            eventId,
            memberId,
            points: points, // Use the value directly as points
          })

          // Update member points tracking
          memberPoints[computingId].total += points
          if (isSpring2025) {
            memberPoints[computingId].spring += points
          } else if (isFall2025) {
            memberPoints[computingId].fall += points
          }
        }
      }
    }

    // Insert attendance records in batches
    if (attendanceRecords.length > 0) {
      console.log(`  Creating ${attendanceRecords.length} attendance records...`)
      const attendanceBatchSize = 100
      let createdCount = 0
      let skippedCount = 0

      for (let i = 0; i < attendanceRecords.length; i += attendanceBatchSize) {
        const batch = attendanceRecords.slice(i, i + attendanceBatchSize)
        
        // Check for existing records first
        const existingChecks = await Promise.all(
          batch.map(async (record) => {
            const { data } = await supabase
              .from('event_attendance')
              .select('id')
              .eq('eventId', record.eventId)
              .eq('memberId', record.memberId)
              .maybeSingle()
            return { record, exists: !!data }
          })
        )

        const newRecords = existingChecks
          .filter(({ exists }) => !exists)
          .map(({ record }) => record)

        if (newRecords.length > 0) {
          const { error: attendanceError } = await supabase
            .from('event_attendance')
            .insert(newRecords)

          if (attendanceError) {
            console.error('Error creating attendance records:', attendanceError)
            console.error('Failed at batch starting at index:', i)
            process.exit(1)
          }

          createdCount += newRecords.length
        }

        skippedCount += existingChecks.filter(({ exists }) => exists).length
      }

      console.log(`  Successfully created ${createdCount} attendance records`)
      if (skippedCount > 0) {
        console.log(`  Skipped ${skippedCount} duplicate attendance records`)
      }
    }

    // Step 4: Update member totals based on attendance
    console.log('\nUpdating member point totals...')
    const updateBatchSize = 50
    const membersToUpdate = Object.entries(memberPoints)
      .filter(([_, points]) => points.total > 0)
      .map(([computingId, points]) => ({
        computingId,
        ...points,
      }))

    for (let i = 0; i < membersToUpdate.length; i += updateBatchSize) {
      const batch = membersToUpdate.slice(i, i + updateBatchSize)

      for (const memberUpdate of batch) {
        const { error: updateError } = await supabase
          .from('members')
          .update({
            totalPoints: memberUpdate.total,
            spring2025Total: memberUpdate.spring,
            fall2025Total: memberUpdate.fall,
          })
          .eq('computingId', memberUpdate.computingId)

        if (updateError) {
          console.error(`Error updating member ${memberUpdate.computingId}:`, updateError)
        }
      }
    }

    console.log(`  Updated point totals for ${membersToUpdate.length} members`)

    console.log('\n✅ Database seeding completed successfully!')
    console.log(`   - ${Object.keys(eventMap).length} events`)
    console.log(`   - ${totalInserted} members`)
    console.log(`   - ${attendanceRecords.length} attendance records`)
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase()

