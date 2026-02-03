/*
  # Trial Room Database Schema

  1. New Tables
    - `sessions`
      - `id` (uuid, primary key) - Unique session identifier
      - `store_id` (text) - Store identifier from URL
      - `owner_id` (uuid) - Anonymous user ID from auth.uid()
      - `created_at` (timestamptz) - Session creation time
      - `expires_at` (timestamptz) - Session expiration time (30 minutes from creation)
    
    - `inventory`
      - `id` (uuid, primary key) - Unique inventory item identifier
      - `store_id` (text) - Store identifier
      - `name` (text) - Item name
      - `created_at` (timestamptz) - Item creation time

  2. Security
    - Enable RLS on both tables
    - Sessions: Users can create their own sessions and read sessions they own
    - Inventory: Authenticated users can read inventory for any store
*/

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can create their own sessions"
  ON sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can read their own sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Inventory policies
CREATE POLICY "Authenticated users can read inventory"
  ON inventory
  FOR SELECT
  TO authenticated
  USING (true);