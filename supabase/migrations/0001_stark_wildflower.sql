/*
  # Job Postings Schema

  1. New Tables
    - `schools`
    - `school_members` (for managing school ownership)
    - `jobs`

  2. Security
    - Enable RLS on all tables
    - Public read access for jobs and schools
    - Authenticated write access based on school membership
*/

-- Create schools table
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  contact jsonb NOT NULL,
  location jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create school members table
CREATE TABLE school_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, created_by)
);

-- Create jobs table
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  description text NOT NULL,
  requirements text[] NOT NULL,
  salary_min integer NOT NULL,
  salary_max integer NOT NULL,
  type text NOT NULL,
  experience text NOT NULL,
  subject text NOT NULL,
  location jsonb NOT NULL,
  posted_date timestamptz DEFAULT now(),
  deadline timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for schools
CREATE POLICY "Allow public read access on schools"
  ON schools FOR SELECT TO public
  USING (true);

CREATE POLICY "Allow authenticated users to create schools"
  ON schools FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow school owners to update their school"
  ON schools FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM school_members
    WHERE school_members.school_id = schools.id
    AND school_members.created_by = auth.uid()
    AND school_members.role = 'owner'
  ));

-- Create policies for school_members
CREATE POLICY "Allow members to view their memberships"
  ON school_members FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Allow school owners to manage members"
  ON school_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM school_members owners
      WHERE owners.school_id = school_members.school_id
      AND owners.created_by = auth.uid()
      AND owners.role = 'owner'
    )
  );

-- Create policies for jobs
CREATE POLICY "Allow public read access on jobs"
  ON jobs FOR SELECT TO public
  USING (true);

CREATE POLICY "Allow school owners and admins to manage jobs"
  ON jobs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = jobs.school_id
      AND school_members.created_by = auth.uid()
      AND school_members.role IN ('owner', 'admin')
    )
  );