/*
  # Add image_url and scale_factor columns to inventory

  1. Changes
    - Add `image_url` column for storing garment image path
    - Add `scale_factor` column for default scaling of garments

  2. Notes
    - image_url stores the path to the image in storage
    - scale_factor defaults to 1.0 for normal sizing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE inventory ADD COLUMN image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'scale_factor'
  ) THEN
    ALTER TABLE inventory ADD COLUMN scale_factor numeric DEFAULT 1.0;
  END IF;
END $$;