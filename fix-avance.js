const fs = require('fs');
const contenido = fs.readFileSync('app/mi-avance/page.tsx', 'utf8');
// Solo agregar el createClient correcto
const nuevo = contenido
  .replace("import { supabase } from '@/lib/supabase'", 
    "import { createClient } from '@supabase/supabase-js'\n\nconst supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!\n)")
  .replace(".select('campo, contenido, pda, fecha_abordado')", 
    ".select('campo, pda_literal, is_primary, covered_on, times_used')")
  .replace(".order('fecha_abordado', { ascending: false })", '');
fs.writeFileSync('app/mi-avance/page.tsx', nuevo);
console.log('OK');