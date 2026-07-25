-- Ajouter la valeur 'electromenager' à l'ENUM product_category
ALTER TYPE product_category ADD VALUE 'electromenager';

-- Ajouter les colonnes spécifiques à l'électroménager
ALTER TABLE products ADD COLUMN electromenager_sous_categorie text;
ALTER TABLE products ADD COLUMN electromenager_marque text;
ALTER TABLE products ADD COLUMN electromenager_modele text;
ALTER TABLE products ADD COLUMN electromenager_garantie_mois integer;
ALTER TABLE products ADD COLUMN electromenager_niveau_sonore_db numeric;
ALTER TABLE products ADD COLUMN electromenager_classe_energie text;
ALTER TABLE products ADD COLUMN electromenager_couleur text;
ALTER TABLE products ADD COLUMN electromenager_materiau text;
ALTER TABLE products ADD COLUMN electromenager_installation text;