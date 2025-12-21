
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'ESP de Dakar.

## 🛠 Script SQL de Configuration (Correction de la Récursion Infinie)

L'erreur "infinite recursion detected in policy" survient lorsque les politiques RLS d'une table interrogent cette même table. Pour corriger cela, nous utilisons des fonctions `SECURITY DEFINER` qui s'exécutent avec les privilèges du créateur (bypassant le RLS) pour récupérer les informations nécessaires.

Copiez et exécutez ce script dans le **SQL Editor de Supabase** :

```sql
-- ==========================================
-- 1. FONCTIONS DE SÉCURITÉ (Fix Récursion)
-- ==========================================
-- Ces fonctions permettent de récupérer les infos de l'utilisateur courant sans boucle infinie

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_class()
RETURNS text AS $$
  SELECT classname FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 2. TABLE DES PROFILS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'student',
    classname TEXT,
    school_name TEXT DEFAULT 'ESP Dakar',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation RLS Profils
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Politiques Profils (Simples pour éviter la récursion)
DROP POLICY IF EXISTS "Profils visibles par tous" ON public.profiles;
CREATE POLICY "Profils visibles par tous" ON public.profiles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Modification propre profil" ON public.profiles;
CREATE POLICY "Modification propre profil" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ==========================================
-- 3. SYSTÈME DE SONDAGES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    is_active BOOLEAN DEFAULT true,
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (poll_id, user_id)
);

-- ==========================================
-- 4. LOGIQUE DE SYNCHRONISATION DES VOTES
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_poll_vote_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.poll_options SET votes = votes - 1 WHERE id = OLD.option_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.option_id <> NEW.option_id) THEN
            UPDATE public.poll_options SET votes = votes - 1 WHERE id = OLD.option_id;
            UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_poll_vote_sync ON public.poll_votes;
CREATE TRIGGER tr_poll_vote_sync
AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.handle_poll_vote_sync();

-- ==========================================
-- 5. POLITIQUES DE SÉCURITÉ (RLS SONDAGES)
-- ==========================================
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Sondages : Utilisation des fonctions sécurisées pour éviter la récursion
DROP POLICY IF EXISTS "Lecture Sondages" ON public.polls;
CREATE POLICY "Lecture Sondages" ON public.polls
FOR SELECT TO authenticated
USING (
    classname = 'Général' OR 
    classname = get_my_class() OR
    get_my_role() IN ('admin', 'delegate')
);

DROP POLICY IF EXISTS "Gestion Sondages" ON public.polls;
CREATE POLICY "Gestion Sondages" ON public.polls
FOR ALL TO authenticated
USING (get_my_role() IN ('admin', 'delegate'));

-- Options & Votes
DROP POLICY IF EXISTS "Lecture Options" ON public.poll_options;
CREATE POLICY "Lecture Options" ON public.poll_options FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Action de Voter" ON public.poll_votes;
CREATE POLICY "Action de Voter" ON public.poll_votes
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.polls WHERE id = poll_id AND is_active = true)
);

DROP POLICY IF EXISTS "Lecture propre vote" ON public.poll_votes;
CREATE POLICY "Lecture propre vote" ON public.poll_votes
FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

## 🛠 Configuration Supabase
1. Créez un projet sur [Supabase](https://supabase.com).
2. Copiez l'URL et la clé ANON dans `services/supabaseClient.ts`.
3. Désactivez **"Confirm Email"** dans *Authentication > Settings*.
4. **IMPORTANT** : Exécutez le script SQL ci-dessus pour initialiser les tables et les fonctions de sécurité.
