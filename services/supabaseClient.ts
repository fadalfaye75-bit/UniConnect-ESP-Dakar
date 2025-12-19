
import { createClient } from '@supabase/supabase-js';

// Assurez-vous que l'URL commence bien par https:// et qu'il n'y a pas d'espace
const supabaseUrl = 'https://jjnujjwgtpjhbuqvpnly.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbnVqandndHBqaGJ1cXZwbmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjYxNDEsImV4cCI6MjA4MTU0MjE0MX0.7p2qKuf45TyJFkpD3OVMGwqVGTKSy-VW3z5Iw5w8wWM';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase configuration missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
