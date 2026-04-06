-- =============================================
-- FIX: Contrainte status + ajout champs mission
-- =============================================

-- 1. Supprimer l'ancienne contrainte qui bloque
ALTER TABLE candidats DROP CONSTRAINT IF EXISTS candidats_status_check;

-- 2. Recréer avec toutes les valeurs acceptées
ALTER TABLE candidats ADD CONSTRAINT candidats_status_check 
CHECK (status IN ('disponible', 'en_mission', 'indisponible', 'En mission', 'Disponible', 'Indisponible'));

-- 3. Ajouter les nouveaux champs
ALTER TABLE candidats 
ADD COLUMN IF NOT EXISTS mission_end_date DATE,
ADD COLUMN IF NOT EXISTS recontact_date DATE,
ADD COLUMN IF NOT EXISTS mission_client TEXT,
ADD COLUMN IF NOT EXISTS mission_notes TEXT;

-- 4. Forcer le refresh du cache Supabase
NOTIFY pgrst, 'reload schema';

SELECT 'Contrainte corrigée + champs mission ajoutés !' as message;
