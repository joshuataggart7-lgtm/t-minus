-- =====================================================================================
-- DEMO_HOLE_UP_DRAFT.sql  v4 (DRAFT, NOT APPLIED, NOT SENT TO LOVABLE). 26 Sep 2026, ~05:00 CT
-- T-Minus / Supabase zgrgfkpfkhocljoqhknv. Plan: DEMO_HOLE_PLAN_V3_2026-09-26.md (v4 notes appended).
-- v4 = CoS ruling (d) 26 Sep: NO BEGIN;/COMMIT; (matches the 82 existing migrations). EVERY must-be-atomic step
-- (guards, DDL via EXECUTE, DML, marker, JWT-claim probe and post-checks) is inside ONE DO block. A DO block is
-- one statement: any exception anywhere in it undoes everything it did, whether the runner wraps the file in a
-- transaction, runs it in autocommit, or batches it with other files. Logic is unchanged from v3.
-- v3 copy: qa_login_evidence/superseded_v3_2026-09-26/DEMO_HOLE_UP_DRAFT.sql.
-- Decision (c), Josh via CoS 12:21 CT 25 Sep: close the demo write hole. v3/v4 add CoS direction of 26 Sep.
--
-- What the block does, as postgres:
--   0. Guards: live objects match the before-capture (fresh) OR the state DOWN v4 leaves behind (re-UP).
--   1. Backs up (idempotent, keyed on id) and deletes every user_roles row held by an ANONYMOUS auth user
--      (47 at capture, all 'specialist', from the 15 Sep backfill). NEEDS JOSH'S EXPLICIT OK (data change).
--   2. private.is_specialist(): drops "OR private.is_demo()" (same signature/volatility/definer/search_path).
--   3. ALTER POLICY on the 6 policies that call is_demo() directly: the is_demo() term is removed.
--   4. Trigger private.reject_anonymous_user_roles() BEFORE INSERT OR UPDATE ON public.user_roles.
--   5. RESTRICTIVE "demo_block_{insert,update,delete}" = NOT private.is_demo(), TO authenticated, on audit_log,
--      comments, document_shares, clause_mod_tasks, research_findings, template_defects, document_checkouts,
--      document_read_receipts, documents and storage.objects (ALL buckets), plus "demo_block_select" on
--      document_shares. 31 policies. (SELECT private.is_demo()) is evaluated once per statement.
--   6. One audit_log marker row.   7. Post-checks (JWT claims set with is_local => undone with the block).
-- NOT in this migration (CoS ruling f): the document_read_receipts UPDATE USING(true) policy is tracked in
-- DEMO_HOLE_ACTOR_BINDING_TICKET_2026-09-26.md. Service-role server writes need the paired client/server change.
-- Reverse: DEMO_HOLE_DOWN_DRAFT.sql v4 (functions/policies only). Rehearsal: DEMO_HOLE_REHEARSAL.sql v4.
-- =====================================================================================

DO $demo_up$
DECLARE
  n int;
  t text;
  n_anon int;
  n_backed int;
  n_missing int;
  n_deleted int;
BEGIN
  -- 0. Guards.
  IF position('is_demo()' IN pg_get_functiondef('private.is_specialist()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'private.is_specialist() no longer calls is_demo(); live state differs from the before-capture';
  END IF;
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public'
     AND (tablename, policyname) IN (('memo_routing','memo_routing_create'), ('memo_routing','memo_routing_edit'),
                                     ('nf1707_approvals','nf1707_approvals_create'), ('nf1707_approvals','nf1707_approvals_edit'),
                                     ('scenario_trigger_config','scenario_trigger_config_create'), ('scenario_trigger_config','scenario_trigger_config_edit'))
     AND permissive = 'PERMISSIVE'
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_demo()%';
  IF n <> 6 THEN RAISE EXCEPTION 'Expected 6 direct is_demo() policies, found %', n; END IF;
  SELECT count(*) INTO n FROM pg_policies
   WHERE permissive = 'PERMISSIVE' AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_demo()%';
  IF n <> 6 THEN RAISE EXCEPTION 'Expected is_demo() in exactly 6 permissive policies, found % (new policy since capture?)', n; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE policyname LIKE 'demo_block_%';
  IF n <> 0 THEN RAISE EXCEPTION '% demo_block_* policies already exist; UP appears to be applied', n; END IF;
  SELECT count(*) INTO n FROM pg_policy WHERE NOT polpermissive;
  IF n <> 0 THEN RAISE EXCEPTION 'Expected 0 RESTRICTIVE policies before UP (capture 26 Sep), found %', n; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.user_roles'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'public.user_roles already has a trigger; live state differs from the capture';
  END IF;
  IF to_regprocedure('private.reject_anonymous_user_roles()') IS NOT NULL THEN
    RAISE EXCEPTION 'private.reject_anonymous_user_roles() already exists';
  END IF;
  IF (SELECT count(*) FROM storage.buckets) <> 1 THEN
    RAISE NOTICE 'storage.buckets count changed since capture (was 1: attachments); demo_block_* still covers all buckets';
  END IF;
  IF position('storage.objects' IN coalesce(current_setting('supautils.policy_grants', true), '')) = 0 THEN
    RAISE EXCEPTION 'supautils.policy_grants does not list storage.objects; postgres cannot create storage policies here';
  END IF;

  -- 1. Back up and remove role rows held by anonymous sessions (idempotent backup; re-UP safe).
  EXECUTE $demo_up_backup$CREATE TABLE IF NOT EXISTS private.demo_hole_user_roles_backup_20260925 (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL,
  role        public.app_role NOT NULL,
  created_at  timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now()
)$demo_up_backup$;
  EXECUTE 'REVOKE ALL ON private.demo_hole_user_roles_backup_20260925 FROM PUBLIC, anon, authenticated';
  SELECT count(*) INTO n_anon FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE u.is_anonymous;
  EXECUTE $demo_up_copy$INSERT INTO private.demo_hole_user_roles_backup_20260925 (id, user_id, role, created_at)
  SELECT r.id, r.user_id, r.role, r.created_at
    FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
   WHERE u.is_anonymous
  ON CONFLICT (id) DO NOTHING$demo_up_copy$;
  GET DIAGNOSTICS n_backed = ROW_COUNT;
  EXECUTE $demo_up_missing$SELECT count(*)
    FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
   WHERE u.is_anonymous
     AND NOT EXISTS (SELECT 1 FROM private.demo_hole_user_roles_backup_20260925 b
                      WHERE b.id = r.id AND b.user_id = r.user_id AND b.role = r.role)$demo_up_missing$ INTO n_missing;
  IF n_missing <> 0 THEN RAISE EXCEPTION '% anonymous role rows are not in the backup; aborting', n_missing; END IF;
  DELETE FROM public.user_roles r USING auth.users u
   WHERE u.id = r.user_id AND u.is_anonymous;
  GET DIAGNOSTICS n_deleted = ROW_COUNT;
  IF n_deleted <> n_anon THEN
    RAISE EXCEPTION 'Deleted % anonymous role rows but counted %; aborting', n_deleted, n_anon;
  END IF;
  RAISE NOTICE 'Anonymous role rows: counted %, newly backed up %, deleted % (47 expected on first UP)', n_anon, n_backed, n_deleted;

  -- 2. is_specialist without the demo bypass.
  EXECUTE $demo_up_fn1$CREATE OR REPLACE FUNCTION private.is_specialist()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT private.has_any_role(auth.uid(), ARRAY['specialist','hq']::public.app_role[])
$function$$demo_up_fn1$;

  -- 3. Direct is_demo() policies: remove only the is_demo() term.
  EXECUTE $demo_up_p1$ALTER POLICY memo_routing_create ON public.memo_routing
  WITH CHECK (private.is_specialist() OR private.is_admin())$demo_up_p1$;
  EXECUTE $demo_up_p2$ALTER POLICY memo_routing_edit ON public.memo_routing
  USING (private.is_specialist() OR private.is_admin())
  WITH CHECK (private.is_specialist() OR private.is_admin())$demo_up_p2$;
  EXECUTE $demo_up_p3$ALTER POLICY nf1707_approvals_create ON public.nf1707_approvals
  WITH CHECK (private.is_specialist() OR private.is_admin())$demo_up_p3$;
  EXECUTE $demo_up_p4$ALTER POLICY nf1707_approvals_edit ON public.nf1707_approvals
  USING (private.is_specialist() OR private.is_admin() OR (owner_name = ( SELECT users.name
   FROM users
  WHERE (users.user_id = auth.uid()))))
  WITH CHECK (private.is_specialist() OR private.is_admin() OR (owner_name = ( SELECT users.name
   FROM users
  WHERE (users.user_id = auth.uid()))))$demo_up_p4$;
  EXECUTE $demo_up_p5$ALTER POLICY scenario_trigger_config_create ON public.scenario_trigger_config
  WITH CHECK (private.has_role(auth.uid(), 'hq'::app_role) OR private.is_admin())$demo_up_p5$;
  EXECUTE $demo_up_p6$ALTER POLICY scenario_trigger_config_edit ON public.scenario_trigger_config
  USING (private.has_role(auth.uid(), 'hq'::app_role) OR private.is_admin())
  WITH CHECK (private.has_role(auth.uid(), 'hq'::app_role) OR private.is_admin())$demo_up_p6$;

  -- 4. No role rows for anonymous users, from any path.
  EXECUTE $demo_up_fn2$CREATE FUNCTION private.reject_anonymous_user_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.user_id AND u.is_anonymous) THEN
    RAISE EXCEPTION 'Roles cannot be given to an anonymous (demo) session'
      USING ERRCODE = '42501', HINT = 'Sign in with a real account before assigning a role.';
  END IF;
  RETURN NEW;
END;
$function$$demo_up_fn2$;
  EXECUTE 'REVOKE ALL ON FUNCTION private.reject_anonymous_user_roles() FROM PUBLIC, anon, authenticated';
  EXECUTE $demo_up_trg$CREATE TRIGGER reject_anonymous_user_roles
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.reject_anonymous_user_roles()$demo_up_trg$;

  -- 5. RESTRICTIVE demo write blocks (31 policies).
  FOREACH t IN ARRAY ARRAY['public.audit_log','public.comments','public.document_shares','public.clause_mod_tasks',
                           'public.research_findings','public.template_defects','public.document_checkouts',
                           'public.document_read_receipts','public.documents','storage.objects']
  LOOP
    EXECUTE format('CREATE POLICY demo_block_insert ON %s AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_demo()))', t);
    EXECUTE format('CREATE POLICY demo_block_update ON %s AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_demo())) WITH CHECK (NOT (SELECT private.is_demo()))', t);
    EXECUTE format('CREATE POLICY demo_block_delete ON %s AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_demo()))', t);
  END LOOP;
  EXECUTE 'CREATE POLICY demo_block_select ON public.document_shares AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (SELECT private.is_demo()))';

  -- 6. Marker.
  INSERT INTO public.audit_log (acquisition_id, actor, action, field, old_value, new_value, reason)
  VALUES (NULL, 'System migration', 'Demo write access closed', 'rls',
          'private.is_specialist() OR is_demo(); 6 direct is_demo() policies; anonymous user_roles rows; no restrictive policies',
          'is_specialist = has_any_role(specialist, hq) only; is_demo() removed from 6 policies; anonymous role rows backed up to private.demo_hole_user_roles_backup_20260925 and removed; user_roles anonymous-reject trigger; 31 RESTRICTIVE demo_block_* policies (10 tables incl. storage.objects; document_shares SELECT)',
          'DEMO_HOLE_UP v4 2026-09-26; approved: J. Taggart via CoS 12:21 CT 25 Sep (decision c) + CoS direction 26 Sep');

  -- 7. Post-checks, still inside the block. The probe claim is set with is_local = true and cleared at the end;
  --    if anything raises, the setting is undone with the block.
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000d0","role":"authenticated","is_anonymous":true}', true);
  IF private.is_specialist() THEN RAISE EXCEPTION 'A fresh anonymous session is still a specialist'; END IF;
  IF NOT private.is_demo() THEN RAISE EXCEPTION 'is_demo() probe did not see the anonymous claim (test setup)'; END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) INTO n FROM pg_policies
   WHERE permissive = 'PERMISSIVE' AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_demo()%';
  IF n <> 0 THEN RAISE EXCEPTION '% permissive policies still reference is_demo()', n; END IF;
  SELECT count(*) INTO n FROM pg_policies
   WHERE permissive = 'RESTRICTIVE' AND policyname LIKE 'demo_block_%' AND roles = '{authenticated}'
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_demo()%';
  IF n <> 31 THEN RAISE EXCEPTION 'Expected 31 restrictive demo_block_* policies, found %', n; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'demo_block_%';
  IF n <> 3 THEN RAISE EXCEPTION 'Expected 3 demo_block_* policies on storage.objects, found %', n; END IF;
  IF position('is_demo()' IN pg_get_functiondef('private.is_specialist()'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'is_specialist() still references is_demo()';
  END IF;
  SELECT count(*) INTO n FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE u.is_anonymous;
  IF n <> 0 THEN RAISE EXCEPTION '% anonymous role rows remain', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.user_roles'::regclass
                  AND tgname = 'reject_anonymous_user_roles' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'user_roles anonymous-reject trigger missing or disabled';
  END IF;
  SELECT count(DISTINCT r.user_id) INTO n FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
   WHERE NOT u.is_anonymous AND r.role IN ('specialist','hq','administrator');
  IF n < 1 THEN RAISE EXCEPTION 'No real specialist/hq/admin account left'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '749411d4-ca03-4cba-b87e-660a155366c3' AND role = 'administrator') THEN
    RAISE EXCEPTION 'J. Taggart administrator role row missing';
  END IF;
  -- @@FAILTEST-INJECT@@ (rehearsal builders replace this one line with a forced failing post-check; in the migration it is only a comment)
  RAISE NOTICE 'DEMO_HOLE UP v4 applied: 31 restrictive policies, trigger, is_specialist fixed, post-checks passed';
END
$demo_up$;