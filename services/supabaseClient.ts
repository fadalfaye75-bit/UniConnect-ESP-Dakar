
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjnujjwgtpjhbuqvpnly.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbnVqandndHBqaGJ1cXZwbmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjYxNDEsImV4cCI6MjA4MTU0MjE0MX0.7p2qKuf45TyJFkpD3OVMGwqVGTKSy-VW3z5Iw5w8wWM';

export const supabase = createClient(supabaseUrl, supabaseKey);
