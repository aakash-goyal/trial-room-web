/*
  # Add Customer Image Support

  1. Changes to `sessions` table
    - Add `customer_image_path` (text, nullable) - Path to customer photo in Supabase Storage
  
  2. Storage
    - Creates `trial-images` bucket for storing customer photos
    - Bucket is private (requires authentication)
  
  3. Security
    - Add UPDATE policy for sessions so users can update their own sessions with image path
    - Add storage policies for trial-images bucket
*/

-- Add customer_image_path column to sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'customer_image_path'
  ) THEN
    ALTER TABLE sessions ADD COLUMN customer_image_path text;
  END IF;
END $$;

-- Add UPDATE policy for sessions
CREATE POLICY "Users can update their own sessions"
  ON sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Create storage bucket for trial images
INSERT INTO storage.buckets (id, name, public)
VALUES ('trial-images', 'trial-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for trial-images bucket
CREATE POLICY "Users can upload their own trial images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'trial-images' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their own trial images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'trial-images' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM sessions WHERE owner_id = auth.uid()
    )
  );