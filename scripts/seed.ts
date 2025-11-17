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

async function seedDatabase() {
  try {
    // Read members.json
    const membersPath = path.join(__dirname, '../data/members.json')
    const membersData: MemberData[] = JSON.parse(
      fs.readFileSync(membersPath, 'utf-8')
    )

    console.log(`Found ${membersData.length} members to seed`)

    // Prepare members for insertion
    const membersToInsert = membersData.map((member) => ({
      name: member.name,
      email: member.email,
      computingId: member.computingId.toLowerCase(),
      isExec: member.isExec,
      totalPoints: member.totalPoints,
      spring2025Total: member.spring2025Total,
      fall2025Total: member.fall2025Total,
      // Don't set password - will use default on first login
    }))

    // Insert members in batches to avoid overwhelming the database
    const batchSize = 50
    let totalInserted = 0

    for (let i = 0; i < membersToInsert.length; i += batchSize) {
      const batch = membersToInsert.slice(i, i + batchSize)
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} members)...`)

      const { data, error } = await supabase
        .from('members')
        .upsert(batch, {
          onConflict: 'computingId',
          ignoreDuplicates: false,
        })
        .select()

      if (error) {
        console.error('Error seeding database:', error)
        console.error('Failed at batch starting at index:', i)
        process.exit(1)
      }

      totalInserted += data?.length || 0
    }

    console.log(`Successfully seeded ${totalInserted} members`)
    console.log('Database seeding completed!')
  } catch (error) {
    console.error('Error reading members.json:', error)
    process.exit(1)
  }
}

seedDatabase()

