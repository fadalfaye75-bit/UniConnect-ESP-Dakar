
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée conçue pour l'École Supérieure Polytechnique de Dakar.

## 🚀 Réparation de la Base de Données (Supabase)

Si vous rencontrez l'erreur **"Could not find column creator_id"**, copiez et exécutez ce script **exactement** dans l'éditeur SQL de votre dashboard Supabase :

```sql
-- 1. AJOUT DIRECT DES COLONNES MANQUANTES
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS classname TEXT DEFAULT 'Général';
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);

-- 2. RÉINITIALISATION DES POLITIQUES DE SÉCURITÉ (RLS)
DROP POLICY IF EXISTS "Lecture_Sondages_Classe" ON public.polls;
CREATE POLICY "Lecture_Sondages_Classe" ON public.polls 
FOR SELECT TO authenticated 
USING (
    classname = 'Général' 
    OR classname = (SELECT classname FROM public.profiles WHERE id = auth.uid())
    OR creator_id = auth.uid()
);

-- 3. COMMANDE CRITIQUE : FORCE LE RAFRAÎCHISSEMENT DU CACHE DE L'API
-- Sans cette ligne, Supabase ne verra pas les nouvelles colonnes pendant plusieurs minutes.
NOTIFY pgrst, 'reload schema';
```

## 🛠 Variables d'Environnement
- `API_KEY` : Clé Google Gemini.
- `VITE_SUPABASE_URL` : URL de votre projet Supabase.
- `VITE_SUPABASE_ANON_KEY` : Clé API anonyme.
