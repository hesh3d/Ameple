-- Run this once in Supabase SQL Editor to enable real-time for the users table
-- (Already included in reset-and-rebuild.sql for fresh installs)

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
