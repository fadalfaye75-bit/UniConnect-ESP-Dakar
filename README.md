
# 🎓 UniConnect - Portail ESP Dakar

UniConnect est une plateforme de gestion scolaire centralisée conçue pour l'École Supérieure Polytechnique de Dakar.

## 🚀 Déploiement Rapide

### 1. Configuration Supabase (Base de données)
Copiez et exécutez ce script SQL dans l'onglet **SQL Editor** de votre tableau de bord Supabase :

```sql
-- ENABLE RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR POLLS
CREATE POLICY "Lecture : Tous les authentifiés voient les sondages de leur classe" ON polls
FOR SELECT TO authenticated
USING (classname = 'Général' OR classname = (SELECT classname FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Gestion : Admins et Délégués uniquement" ON polls
FOR ALL TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'delegate')
);

-- POLICIES FOR OPTIONS
CREATE POLICY "Lecture : Options visibles pour sondages accessibles" ON poll_options
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM polls 
    WHERE polls.id = poll_options.poll_id
    AND (polls.classname = 'Général' OR polls.classname = (SELECT classname FROM profiles WHERE id = auth.uid()))
  )
);

CREATE POLICY "Gestion : Admins et Délégués" ON poll_options
FOR ALL TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'delegate')
);

-- POLICIES FOR VOTES
CREATE POLICY "Lecture : Voir son propre vote" ON poll_votes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Vote : Insertion pour soi-même" ON poll_votes
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Vote : Modification pour soi-même" ON poll_votes
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- FUNCTION: VOTE ATOMIQUE (Gère l'incrémentation propre)
CREATE OR REPLACE FUNCTION vote_for_option(p_poll_id UUID, p_option_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    old_option_id UUID;
BEGIN
    SELECT option_id INTO old_option_id FROM poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id;

    IF old_option_id IS NOT NULL THEN
        UPDATE poll_options SET votes = votes - 1 WHERE id = old_option_id;
        UPDATE poll_votes SET option_id = p_option_id WHERE poll_id = p_poll_id AND user_id = p_user_id;
    ELSE
        INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (p_poll_id, p_option_id, p_user_id);
    END IF;

    UPDATE poll_options SET votes = votes + 1 WHERE id = p_option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Déploiement Frontend
1. Hébergez le code sur **Vercel** ou **Netlify**.
2. Configurez les **Variables d'Environnement** :
   - `API_KEY` : Votre clé Google Gemini (pour l'Assistant IA).
   - `VITE_SUPABASE_URL` : URL de votre projet Supabase.
   - `VITE_SUPABASE_ANON_KEY` : Clé API anonyme de votre projet.

## 🛠 Fonctionnalités
- 📊 **Tableau de bord dynamique** : Vue d'ensemble des examens et annonces.
- 📢 **Annonces Priorisées** : Filtrez par urgence (Urgent, Important, Normal).
- 📅 **Gestion des Examens** : Compte à rebours J-3 pour les épreuves.
- 🗳 **Sondages avec Analytics** : Diagrammes circulaires Recharts intégrés.
- 🤖 **Assistant IA** : Piloté par Gemini 2.0 pour répondre aux questions scolaires.

---
*Développé avec passion pour l'excellence académique à l'ESP.*
