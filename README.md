
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire centralisée conçue pour l'École Supérieure Polytechnique de Dakar.

## 🚀 Configuration de la Base de Données (Supabase)

Copiez et exécutez l'intégralité de ce script dans votre **SQL Editor** Supabase. Il est conçu pour être exécuté plusieurs fois sans provoquer d'erreurs.

```sql
-- ==========================================
-- 1. CRÉATION DES TABLES DE BASE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'student',
    school_name TEXT DEFAULT 'ESP Dakar',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    priority TEXT DEFAULT 'normal',
    classname TEXT DEFAULT 'Général',
    author_id UUID REFERENCES auth.users(id),
    author_name TEXT,
    attachments TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    exam_date TIMESTAMPTZ NOT NULL,
    duration TEXT,
    room TEXT,
    notes TEXT,
    classname TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meet_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    platform TEXT,
    url TEXT NOT NULL,
    time TEXT,
    classname TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version TEXT NOT NULL,
    url TEXT NOT NULL,
    classname TEXT NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    target_class TEXT DEFAULT 'Général',
    target_role TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor TEXT,
    action TEXT,
    target TEXT,
    type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    creator_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    votes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- ==========================================
-- 2. RÉPARATION DES COLONNES (FIX ERROR 42703)
-- ==========================================

DO $$ 
BEGIN 
    -- Ajout de classname à profiles si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='classname') THEN
        ALTER TABLE public.profiles ADD COLUMN classname TEXT;
    END IF;

    -- Ajout de classname à polls si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='polls' AND column_name='classname') THEN
        ALTER TABLE public.polls ADD COLUMN classname TEXT DEFAULT 'Général';
    END IF;

    -- Ajout de creator_id à polls si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='polls' AND column_name='creator_id') THEN
        ALTER TABLE public.polls ADD COLUMN creator_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- ==========================================
-- 3. ACTIVATION RLS
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE meet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. NETTOYAGE DES POLITIQUES (FIX ERROR 42710)
-- ==========================================

DO $$ 
BEGIN
    -- Suppression pour réinitialisation propre des politiques
    DROP POLICY IF EXISTS "Lecture : Profils publics" ON profiles;
    DROP POLICY IF EXISTS "Modif : Son propre profil" ON profiles;
    DROP POLICY IF EXISTS "Gestion : Admin profiles" ON profiles;
    
    DROP POLICY IF EXISTS "Lecture_Sondages_Classe" ON polls;
    DROP POLICY IF EXISTS "Gestion_Sondages_Admin" ON polls;
    
    DROP POLICY IF EXISTS "Lecture_Options_Visible" ON poll_options;
    DROP POLICY IF EXISTS "Gestion_Options_Admin" ON poll_options;
    
    DROP POLICY IF EXISTS "Lecture_Vote_Propre" ON poll_votes;
    DROP POLICY IF EXISTS "Insert_Vote_Propre" ON poll_votes;

    DROP POLICY IF EXISTS "Lecture : Annonces autorisées" ON announcements;
    DROP POLICY IF EXISTS "Gestion : Annonces delegues admin" ON announcements;

    DROP POLICY IF EXISTS "Lecture : Exams" ON exams;
    DROP POLICY IF EXISTS "Lecture : Meet" ON meet_links;
    DROP POLICY IF EXISTS "Lecture : Schedules" ON schedules;
END $$;

-- ==========================================
-- 5. CRÉATION DES POLITIQUES
-- ==========================================

-- PROFILES
CREATE POLICY "Lecture : Profils publics" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modif : Son propre profil" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Gestion : Admin profiles" ON profiles FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- SONDAGES
-- On autorise la lecture si c'est 'Général', si c'est la classe de l'utilisateur, OU si l'utilisateur est le créateur
CREATE POLICY "Lecture_Sondages_Classe" ON polls FOR SELECT TO authenticated
USING (
    classname = 'Général' 
    OR classname = (SELECT classname FROM profiles WHERE id = auth.uid())
    OR creator_id = auth.uid()
);

CREATE POLICY "Gestion_Sondages_Admin" ON polls FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'delegate'));

-- OPTIONS SONDAGES
CREATE POLICY "Lecture_Options_Visible" ON poll_options FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id AND (polls.classname = 'Général' OR polls.classname = (SELECT classname FROM profiles WHERE id = auth.uid()) OR polls.creator_id = auth.uid())));

CREATE POLICY "Gestion_Options_Admin" ON poll_options FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'delegate'));

-- VOTES
CREATE POLICY "Lecture_Vote_Propre" ON poll_votes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert_Vote_Propre" ON poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ANNONCES
CREATE POLICY "Lecture : Annonces autorisées" ON announcements FOR SELECT TO authenticated 
USING (classname = 'Général' OR classname = (SELECT classname FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Gestion : Annonces delegues admin" ON announcements FOR ALL TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'delegate'));

-- EXAMS, MEET, SCHEDULES (Accès lecture par classe)
CREATE POLICY "Lecture : Exams" ON exams FOR SELECT TO authenticated USING (classname = (SELECT classname FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Lecture : Meet" ON meet_links FOR SELECT TO authenticated USING (classname = (SELECT classname FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Lecture : Schedules" ON schedules FOR SELECT TO authenticated USING (classname = (SELECT classname FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ==========================================
-- 6. FONCTION DE VOTE (RPC)
-- ==========================================

CREATE OR REPLACE FUNCTION vote_for_option(p_poll_id UUID, p_option_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    old_option_id UUID;
BEGIN
    SELECT option_id INTO old_option_id FROM public.poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id;

    IF old_option_id IS NOT NULL THEN
        UPDATE public.poll_options SET votes = votes - 1 WHERE id = old_option_id;
        UPDATE public.poll_votes SET option_id = p_option_id WHERE poll_id = p_poll_id AND user_id = p_user_id;
    ELSE
        INSERT INTO public.poll_votes (poll_id, option_id, user_id) VALUES (p_poll_id, p_option_id, p_user_id);
    END IF;

    UPDATE public.poll_options SET votes = votes + 1 WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🛠 Variables d'Environnement
- `API_KEY` : Clé Google Gemini.
- `VITE_SUPABASE_URL` : URL de votre projet Supabase.
- `VITE_SUPABASE_ANON_KEY` : Clé API anonyme.
