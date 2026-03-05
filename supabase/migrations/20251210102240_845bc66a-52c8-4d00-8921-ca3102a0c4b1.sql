-- Allow CSBD users to manage their own targets
CREATE POLICY "CSBD users can manage their own targets"
ON public.csbd_targets
FOR ALL
USING (user_id = auth.uid() AND has_role(auth.uid(), 'csbd'::app_role))
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'csbd'::app_role));

-- Delete the placeholder target we just created so Sainath can add his own
DELETE FROM csbd_targets WHERE user_id = '8be5f43d-f954-4107-a12b-d240ebe3d7bf' AND fiscal_year = 2025;