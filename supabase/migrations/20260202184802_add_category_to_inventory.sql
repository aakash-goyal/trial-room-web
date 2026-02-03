/*
  # Add category column to inventory

  1. Changes
    - Add `category` column to `inventory` table
    - Column is optional text field for item categorization
    - Stores values like: shirt, tshirt, jeans, trouser

  2. Notes
    - No data migration needed as table is empty
    - Category is used for filtering inventory display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'category'
  ) THEN
    ALTER TABLE inventory ADD COLUMN category text;
  END IF;
END $$;