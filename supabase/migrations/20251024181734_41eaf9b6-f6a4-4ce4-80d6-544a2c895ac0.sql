-- Drop old restrictive policies for master table
DROP POLICY IF EXISTS "Managers can manage master" ON master;

-- Allow all authenticated users to INSERT master records
CREATE POLICY "Authenticated users can create master records"
ON master
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow all authenticated users to UPDATE master records
CREATE POLICY "Authenticated users can update master records"
ON master
FOR UPDATE
TO authenticated
USING (true);

-- Restrict DELETE to managers and admins only
CREATE POLICY "Managers and admins can delete master records"
ON master
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Drop old restrictive policies for clients table
DROP POLICY IF EXISTS "Managers can manage clients" ON clients;

-- Allow all authenticated users to INSERT clients
CREATE POLICY "Authenticated users can create clients"
ON clients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow all authenticated users to UPDATE clients
CREATE POLICY "Authenticated users can update clients"
ON clients
FOR UPDATE
TO authenticated
USING (true);

-- Restrict DELETE to managers and admins only
CREATE POLICY "Managers and admins can delete clients"
ON clients
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);