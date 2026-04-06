import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yvksbqwjryaraueydufw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2a3NicXdqcnlhcmF1ZXlkdWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDY2OTUsImV4cCI6MjA5MDQ4MjY5NX0.eRWWBZV-iBHDEzdiTXZ5IhSFic_cMKzeWGIKnggUE8E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)