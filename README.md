
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire universitaire centralisée pour l'ESP de Dakar.

## 🚀 Optimisation des Consultations (Vitesse & Fluidité)

Pour que l'onglet "Consultations" soit instantané même avec 5000+ étudiants, exécutez ce script dans Supabase :

```sql
-- COMPTEURS DÉNORMALISÉS
ALTER TABLE public.poll_options ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;

-- TRIGGER DE CALCUL INSTANTANÉ
CREATE OR REPLACE FUNCTION public.update_poll_option_count() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
    ELSIF (TG_OP = 'DELETE') THEN UPDATE public.poll_options SET votes = votes - 1 WHERE id = OLD.option_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.option_id <> NEW.option_id) THEN
            UPDATE public.poll_options SET votes = votes - 1 WHERE id = OLD.option_id;
            UPDATE public.poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
        END IF;
    END IF;
    RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_update_poll_option_count AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes FOR EACH ROW EXECUTE FUNCTION public.update_poll_option_count();

-- INDEX DE RECHERCHE RAPIDE
CREATE INDEX IF NOT EXISTS idx_poll_votes_lookup ON public.poll_votes (poll_id, user_id);
CREATE INDEX IF NOT EXISTS idx_polls_classname_active ON public.polls (classname, is_active);
```

## 🛠 Variables d'Environnement
- `API_KEY` : Clé Google Gemini.
- `VITE_SUPABASE_URL` : URL de votre projet Supabase.
- `VITE_SUPABASE_ANON_KEY` : Clé API anonyme.
