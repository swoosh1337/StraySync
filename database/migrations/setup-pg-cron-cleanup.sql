-- =====================================================================
-- Setup pg_cron for Automatic Animal Cleanup
-- Description: Schedules daily automatic cleanup of animals older than 14 days
-- Schedule: Runs daily at 2:00 AM UTC
-- =====================================================================

-- =====================================================================
-- IMPORTANT NOTES:
-- =====================================================================
-- 1. pg_cron extension may require special permissions on Supabase
-- 2. On Supabase free tier, you may need to enable pg_cron via the dashboard:
--    - Go to Database > Extensions
--    - Search for "pg_cron"
--    - Enable it
-- 3. If you get permission errors, you may need to contact Supabase support
--    or upgrade to a paid plan
-- 4. The cron job will run in the database timezone (usually UTC)
-- =====================================================================

-- Enable the pg_cron extension
-- Note: This may fail on Supabase free tier - see notes above
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any existing cleanup job (in case we're re-running this)
-- This prevents duplicate jobs
SELECT cron.unschedule('cleanup-old-animals-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-animals-daily'
);

-- Schedule the cleanup job to run daily at 2 AM UTC
-- Syntax: cron.schedule(job_name, cron_schedule, sql_command)
-- Cron format: minute hour day month day_of_week
-- '0 2 * * *' = At 2:00 AM every day
SELECT cron.schedule(
  'cleanup-old-animals-daily',  -- Job name
  '0 2 * * *',                   -- Cron schedule (2 AM UTC daily)
  $$SELECT public.cleanup_old_animals();$$  -- SQL command to execute
);

-- =====================================================================
-- Verification Queries (run these to check if the job is set up correctly)
-- =====================================================================

-- View all scheduled cron jobs:
-- SELECT * FROM cron.job;

-- View job execution history (last 10 runs):
-- SELECT * FROM cron.job_run_details
-- ORDER BY start_time DESC
-- LIMIT 10;

-- Manually trigger the cleanup (for testing):
-- SELECT * FROM public.cleanup_old_animals();

-- =====================================================================
-- Alternative: Manual Setup via Supabase SQL Editor
-- =====================================================================
-- If this migration fails due to permissions, you can manually set up
-- the cron job in the Supabase SQL Editor:
--
-- 1. First, run the cleanup function SQL from:
--    database/functions/cleanup-old-animals.sql
--
-- 2. Then enable pg_cron in Database > Extensions
--
-- 3. Finally, run this in the SQL Editor:
--    SELECT cron.schedule(
--      'cleanup-old-animals-daily',
--      '0 2 * * *',
--      $$SELECT public.cleanup_old_animals();$$
--    );
-- =====================================================================

-- =====================================================================
-- Troubleshooting
-- =====================================================================
-- If the cron job doesn't seem to be running:
--
-- 1. Check if pg_cron is enabled:
--    SELECT * FROM pg_extension WHERE extname = 'pg_cron';
--
-- 2. Check if the job is scheduled:
--    SELECT * FROM cron.job WHERE jobname = 'cleanup-old-animals-daily';
--
-- 3. Check for errors in job runs:
--    SELECT * FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-animals-daily')
--    ORDER BY start_time DESC;
--
-- 4. Test the function manually:
--    SELECT * FROM public.cleanup_old_animals();
-- =====================================================================

-- =====================================================================
-- Customizing the Schedule
-- =====================================================================
-- To change when the cleanup runs, modify the cron schedule:
--
-- Examples:
-- '0 2 * * *'     = Daily at 2 AM UTC
-- '0 0 * * 0'     = Weekly on Sunday at midnight UTC
-- '0 3 * * 1'     = Weekly on Monday at 3 AM UTC
-- '0 */6 * * *'   = Every 6 hours
-- '30 1 * * *'    = Daily at 1:30 AM UTC
--
-- To update the schedule, first unschedule the old job:
--   SELECT cron.unschedule('cleanup-old-animals-daily');
-- Then create a new one with the desired schedule.
-- =====================================================================
