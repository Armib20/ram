# Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env` (if not already exists)
   - Add your Supabase credentials:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

3. **Set up Supabase database:**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor**
   - Copy and paste the contents of `supabase/schema.sql`
   - Click **Run** to create the tables

4. **Seed the database:**
   ```bash
   pnpm seed
   ```
   This will populate the database with members from `data/members.json`

5. **Start the development server:**
   ```bash
   pnpm dev
   ```

6. **Access the app:**
   - Open `http://localhost:3000`
   - Log in with any computing ID from `members.json`
   - Default password: `rampoints12!`

## Testing

### Test as Regular Member:
- Use any computing ID from `members.json` where `isExec: false`
- Example: `dpr2em` (Logan Kucharski)
- Password: `rampoints12!`

### Test as Exec Member:
- Use any computing ID from `members.json` where `isExec: true`
- Example: `waj5yp` (Ali Rizwan) or `ahw2uu` (Virginia Lee)
- Password: `rampoints12!`

## Features to Test

1. **Login Flow:**
   - First-time login should prompt for password change
   - Subsequent logins should work with new password

2. **Member Dashboard:**
   - View total points
   - View semester breakdown

3. **Exec Dashboard:**
   - Create new events
   - Upload spreadsheet (create a test Excel file with Name and Computing ID columns)
   - Edit member points
   - Search members

## Troubleshooting

### Database Connection Issues
- Verify your Supabase URL and anon key are correct
- Check that RLS policies allow operations (the schema includes permissive policies)

### Seeding Issues
- Ensure `data/members.json` exists and is valid JSON
- Check that the `members` table exists in Supabase
- Verify environment variables are loaded correctly

### Authentication Issues
- Clear browser sessionStorage and try again
- Check that passwords are being stored correctly in the database

