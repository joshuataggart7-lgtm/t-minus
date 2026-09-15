DROP POLICY requester_intake_insert ON public.acquisition_facts;
CREATE POLICY requester_intake_insert
ON public.acquisition_facts
FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'requester'));