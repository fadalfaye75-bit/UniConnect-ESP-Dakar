# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'ESP de Dakar.

## 🚀 Optimisation des Consultations (Vitesse & Fluidité SQL)

Pour garantir que l'onglet **Consultations** reste fluide même avec des milliers de votes simultanés, exécutez ce script dans votre éditeur SQL Supabase :

```sql
-- 1. CACHE DE COMPTEUR (Dénormalisation pour lecture instantanée)
ALTER TABLE public.poll_options ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;

-- 2. INDEXATION STRATÉGIQUE (Recherche ultra-rapide)
-- Accélère le chargement de la liste des sondages par classe
CREATE INDEX IF NOT EXISTS idx_polls_classname_active ON public.polls (classname, is_active);
-- Accélère la vérification "l'utilisateur a-t-il déjà voté ?"
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_poll ON public.poll_votes (user_id, poll_id);

-- 3. TRIGGER ATOMIQUE (Mise à jour en temps réel des compteurs)
CREATE OR REPLACE FUNCTION public.sync_poll_votes_count()
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

DROP TRIGGER IF EXISTS tr_sync_poll_votes ON public.poll_votes;
CREATE TRIGGER tr_sync_poll_votes
AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_poll_votes_count();

-- 4. POLITIQUES DE SÉCURITÉ (RLS) - Permet aux étudiants de voter
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students_can_vote" ON public.poll_votes;
CREATE POLICY "Students_can_vote" ON public.poll_votes
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.polls p
        JOIN public.profiles pr ON pr.id = auth.uid()
        WHERE p.id = poll_id 
        AND (p.classname = 'Général' OR p.classname = pr.classname OR pr.role IN ('admin', 'delegate'))
    )
);

-- 5. INITIALISATION
UPDATE public.poll_options po SET votes = (SELECT count(*) FROM public.poll_votes pv WHERE pv.option_id = po.id);
```

## 🛠 Variables d'Environnement
- `VITE_SUPABASE_URL` : URL de votre projet Supabase.
- `VITE_SUPABASE_ANON_KEY` : Clé API anonyme.
