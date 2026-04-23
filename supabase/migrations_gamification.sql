-- ── Gamification columns ─────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_this_week       integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievements        text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_cards_studied integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfect_quizzes     integer   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quizzes_completed   integer   DEFAULT 0;

-- ── Weekly leaderboard RPC ───────────────────────────────────────────────────
-- SECURITY DEFINER so it bypasses RLS and can read all profiles
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard()
RETURNS TABLE(
  display_name text,
  xp_this_week integer,
  total_xp     integer,
  avatar_char  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(full_name, 'Anonymous') AS display_name,
    COALESCE(xp_this_week, 0)        AS xp_this_week,
    COALESCE(total_xp, 0)            AS total_xp,
    UPPER(LEFT(COALESCE(full_name, 'A'), 1)) AS avatar_char
  FROM public.profiles
  ORDER BY xp_this_week DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard() TO authenticated;

-- ── Reset xp_this_week in the edge function (weekly reset) ───────────────────
-- Add this to supabase/functions/reset-weekly-uploads/index.ts:
-- await supabase.from('profiles').update({ uploads_this_week: 0, xp_this_week: 0, week_reset_at: ... })
