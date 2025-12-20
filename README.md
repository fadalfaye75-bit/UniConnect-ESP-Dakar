# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'ESP de Dakar.

## 🛠 Script SQL de Configuration (Sondages & Profils)

Voici le script complet à copier et exécuter dans le **SQL Editor de Supabase** pour initialiser la base de données nécessaire au bon fonctionnement des sondages et de la gestion des accès.

```sql
-- ==========================================
-- 1. TABLE DES PROFILS (Core Identity)
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

CREATE POLICY "Profils visibles par tous" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Modification propre profil" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ==========================================
-- 2. SYSTÈME DE SONDAGES
-- ==========================================

-- Table des sondages
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    classname TEXT DEFAULT 'Général',
    is_active BOOLEAN DEFAULT true,
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des options
CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des votes (Contrainte d'unicité par utilisateur/sondage)
CREATE TABLE IF NOT EXISTS public.poll_votes (
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (poll_id, user_id)
);

-- ==========================================
-- 3. INDEX & PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_polls_classname ON public.polls(classname);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes(user_id);

-- ==========================================
-- 4. LOGIQUE ATOMIQUE (Trigger de votes)
-- ==========================================
-- Maintient le compteur de votes synchronisé sans requêtes COUNT lourdes
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

-- Sondages : Visibles si publics, ou pour la classe, ou si admin/délégué
CREATE POLICY "Lecture Sondages" ON public.polls
FOR SELECT TO authenticated
USING (
    classname = 'Général' OR 
    classname = (SELECT classname FROM public.profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'delegate'))
);

-- Sondages : Modification par Admin et Délégués uniquement
CREATE POLICY "Gestion Sondages" ON public.polls
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'delegate')));

-- Options : Lecture ouverte
CREATE POLICY "Lecture Options" ON public.poll_options
FOR SELECT TO authenticated
USING (true);

-- Votes : Insertion uniquement pour soi-même et sur sondage actif
CREATE POLICY "Action de Voter" ON public.poll_votes
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.polls WHERE id = poll_id AND is_active = true)
);

-- Votes : Lecture de ses propres choix
CREATE POLICY "Lecture propre vote" ON public.poll_votes
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
```

## 🛠 Configuration Supabase
1. Créez un projet sur [Supabase](https://supabase.com).
2. Copiez l'URL et la clé ANON dans `services/supabaseClient.ts`.
3. Désactivez **"Confirm Email"** dans *Authentication > Settings* pour faciliter les tests.
