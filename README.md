
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée conçue pour l'École Supérieure Polytechnique de Dakar.

## 🚀 Réparation de la Base de Données (Supabase)

Si vous ne pouvez pas **lancer de sondages** ou si vous avez l'erreur **PGRST204**, copiez et exécutez ce script **exactement** dans l'éditeur SQL de votre dashboard Supabase :

```sql
-- 1. AJOUT DES COLONNES MANQUANTES
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS classname TEXT DEFAULT 'Général';
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 2. ACTIVATION RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- 3. DROITS D'INSERTION (Crucial pour lancer le sondage)
DROP POLICY IF EXISTS "Insertion_Sondages_Delegue_Admin" ON public.polls;
CREATE POLICY "Insertion_Sondages_Delegue_Admin" ON public.polls 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 4. DROITS DE LECTURE
DROP POLICY IF EXISTS "Lecture_Sondages_Tous" ON public.polls;
CREATE POLICY "Lecture_Sondages_Tous" ON public.polls 
FOR SELECT TO authenticated 
USING (true);

-- 5. RECHARGEMENT CACHE API
NOTIFY pgrst, 'reload schema';
```

## 🛠 Variables d'Environnement
- `API_KEY` : Clé Google Gemini.
- `VITE_SUPABASE_URL` : URL de votre projet Supabase.
- `VITE_SUPABASE_ANON_KEY` : Clé API anonyme.
