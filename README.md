# RAM Points Tracker - UVA

A sleek web application for tracking points for Remote Area Medical at UVA.

## Features

- **Member Dashboard**: View total points and semester breakdown
- **Exec Dashboard**: 
  - Create and manage events
  - Upload spreadsheets to track attendance
  - Edit point values for all members
  - Search through members

## Setup

### Prerequisites

- Node.js 18+ and pnpm
- A Supabase project

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your Supabase project URL and anon key:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Set up Supabase database:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the SQL from `supabase/schema.sql`

4. Seed the database:
```bash
pnpm seed
```

5. Start the development server:
```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

## Authentication

- **Default Password**: `rampoints12!`
- Users are identified by their computing ID
- On first login, users will be prompted to set a new password
- Exec members are automatically redirected to the exec dashboard

## Usage

### For Members

1. Log in with your computing ID and password
2. View your total points and semester breakdown

### For Exec Members

1. Log in with your computing ID and password
2. Use the tabs to:
   - **Members**: Search and edit point values
   - **Events**: Create new events and add attendance
   - **Upload Spreadsheet**: Upload a spreadsheet with Name and Computing ID columns to create/update members

## Spreadsheet Format

When uploading a spreadsheet, ensure it has the following columns:
- `Name` or `name`
- `Computing ID`, `computingId`, or `ComputingId`

New members will be created automatically if their computing ID doesn't exist.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS (for styling)
- Supabase
- React Router
- XLSX (for spreadsheet parsing)

