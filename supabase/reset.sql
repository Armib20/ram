-- Reset Database Script
-- This script deletes all data from all tables
-- Run this in Supabase SQL Editor to reset your database

-- Delete in order to respect foreign key constraints
-- event_attendance has foreign keys to both events and members
DELETE FROM event_attendance;
DELETE FROM events;
DELETE FROM members;

-- Reset sequences if any (not needed for UUID primary keys, but included for completeness)
-- The tables use UUID primary keys, so no sequences to reset

-- Verify tables are empty
SELECT 
  (SELECT COUNT(*) FROM members) as members_count,
  (SELECT COUNT(*) FROM events) as events_count,
  (SELECT COUNT(*) FROM event_attendance) as attendance_count;

