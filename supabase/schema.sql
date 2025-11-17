-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  computingId TEXT NOT NULL UNIQUE,
  isExec BOOLEAN DEFAULT FALSE,
  totalPoints INTEGER DEFAULT 0,
  spring2025Total INTEGER DEFAULT 0,
  fall2025Total INTEGER DEFAULT 0,
  password TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  eventId UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  memberId UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(eventId, memberId)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_members_computingId ON members(computingId);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_event_attendance_eventId ON event_attendance(eventId);
CREATE INDEX IF NOT EXISTS idx_event_attendance_memberId ON event_attendance(memberId);

-- Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your security needs)
-- For now, allow all operations - you may want to restrict this
CREATE POLICY "Allow all operations on members" ON members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on events" ON events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on event_attendance" ON event_attendance
  FOR ALL USING (true) WITH CHECK (true);

