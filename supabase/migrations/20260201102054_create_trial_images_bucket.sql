/*
  # Create trial-images storage bucket

  1. Storage Setup
    - Creates `trial-images` bucket for customer photo uploads
    - Bucket is private (not public)
  
  2. Security
    - RLS policies for authenticated users to upload to their session paths
    - RLS policies for authenticated users to download from their session paths
    - Users can only access images in sessions they own
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('trial-images', 'trial-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload to their session paths"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trial-images'
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id::text = (storage.foldername(name))[1]
    AND sessions.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can read from their session paths"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trial-images'
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id::text = (storage.foldername(name))[1]
    AND sessions.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update their session images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trial-images'
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id::text = (storage.foldername(name))[1]
    AND sessions.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'trial-images'
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id::text = (storage.foldername(name))[1]
    AND sessions.owner_id = auth.uid()
  )
);