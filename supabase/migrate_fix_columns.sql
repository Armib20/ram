-- Migration script to fix column names from lowercase to camelCase
-- Run this in Supabase SQL Editor if your tables were already created

-- Drop existing indexes first
DROP INDEX IF EXISTS idx_members_computingid;
DROP INDEX IF EXISTS idx_members_email;
DROP INDEX IF EXISTS idx_event_attendance_eventid;
DROP INDEX IF EXISTS idx_event_attendance_memberid;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on members" ON members;
DROP POLICY IF EXISTS "Allow all operations on events" ON events;
DROP POLICY IF EXISTS "Allow all operations on event_attendance" ON event_attendance;

-- Rename columns in members table (if they exist as lowercase)
DO $$ 
BEGIN
  -- Check and rename computingId
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='computingid') THEN
    ALTER TABLE members RENAME COLUMN computingid TO "computingId";
  END IF;
  
  -- Check and rename isExec
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='isexec') THEN
    ALTER TABLE members RENAME COLUMN isexec TO "isExec";
  END IF;
  
  -- Check and rename totalPoints
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='totalpoints') THEN
    ALTER TABLE members RENAME COLUMN totalpoints TO "totalPoints";
  END IF;
  
  -- Check and rename spring2025Total
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='spring2025total') THEN
    ALTER TABLE members RENAME COLUMN spring2025total TO "spring2025Total";
  END IF;
  
  -- Check and rename fall2025Total
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='fall2025total') THEN
    ALTER TABLE members RENAME COLUMN fall2025total TO "fall2025Total";
  END IF;
  
  -- Check and rename createdAt
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='createdat') THEN
    ALTER TABLE members RENAME COLUMN createdat TO "createdAt";
  END IF;
  
  -- Check and rename updatedAt
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='updatedat') THEN
    ALTER TABLE members RENAME COLUMN updatedat TO "updatedAt";
  END IF;
END $$;

-- Rename columns in events table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='createdat') THEN
    ALTER TABLE events RENAME COLUMN createdat TO "createdAt";
  END IF;
END $$;

-- Rename columns in event_attendance table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_attendance' AND column_name='eventid') THEN
    ALTER TABLE event_attendance RENAME COLUMN eventid TO "eventId";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_attendance' AND column_name='memberid') THEN
    ALTER TABLE event_attendance RENAME COLUMN memberid TO "memberId";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_attendance' AND column_name='createdat') THEN
    ALTER TABLE event_attendance RENAME COLUMN createdat TO "createdAt";
  END IF;
END $$;

-- Recreate indexes with correct column names
CREATE INDEX IF NOT EXISTS idx_members_computingId ON members("computingId");
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_event_attendance_eventId ON event_attendance("eventId");
CREATE INDEX IF NOT EXISTS idx_event_attendance_memberId ON event_attendance("memberId");

-- Recreate policies
CREATE POLICY "Allow all operations on members" ON members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on events" ON events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on event_attendance" ON event_attendance
  FOR ALL USING (true) WITH CHECK (true);

