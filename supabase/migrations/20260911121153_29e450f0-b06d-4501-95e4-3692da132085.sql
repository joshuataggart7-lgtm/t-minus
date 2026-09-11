CREATE TABLE public.center_overrides (
  override_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_code text NOT NULL REFERENCES public.centers(center_code) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('threshold','review_trigger')),
  target text NOT NULL,
  value numeric,
  note text,
  citation text,
  effective_date date NOT NULL DEFAULT current_date,
  superseded_date date,
  set_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.center_overrides TO authenticated;
GRANT ALL ON public.center_overrides TO service_role;

ALTER TABLE public.center_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read center overrides"
ON public.center_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can add center overrides"
ON public.center_overrides FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Signed-in users can change center overrides"
ON public.center_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Signed-in users can remove center overrides"
ON public.center_overrides FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_center_overrides_updated_at
BEFORE UPDATE ON public.center_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_center_overrides_center ON public.center_overrides (center_code, kind);

-- ---------------------------------------------------------------- views

CREATE OR REPLACE VIEW public.v_report_missions
WITH (security_invoker = on) AS
SELECT
  m.mission_id,
  m.name AS mission_name,
  m.program,
  m.center_code,
  m.milestone,
  m.milestone_date,
  m.priority,
  m.program_owner,
  (m.milestone_date - current_date) AS days_to_milestone,
  count(a.acquisition_id) AS acquisition_count,
  count(*) FILTER (WHERE a.clock_state = 'launched') AS launched_count,
  count(*) FILTER (WHERE a.clock_state = 'hold') AS on_hold_count
FROM public.missions m
LEFT JOIN public.acquisition_facts a ON a.mission_id = m.mission_id
GROUP BY m.mission_id, m.name, m.program, m.center_code, m.milestone, m.milestone_date, m.priority, m.program_owner;

CREATE OR REPLACE VIEW public.v_report_acquisitions
WITH (security_invoker = on) AS
WITH typed AS (
  SELECT a.*,
    CASE WHEN a.competition ILIKE '%sole%' THEN 'commercial_ffp_13_5_sole_source'
         ELSE 'commercial_ffp_13_5_competed' END AS acquisition_type
  FROM public.acquisition_facts a
), planned AS (
  SELECT t.acquisition_id, coalesce(sum(p.planned_days), 0) AS planned_days_to_award
  FROM typed t
  LEFT JOIN public.phase_plan p ON p.acquisition_type = t.acquisition_type
  GROUP BY t.acquisition_id
), pollagg AS (
  SELECT acquisition_id,
    count(*) FILTER (WHERE vote IS NULL OR vote = 'pending') AS open_polls,
    count(*) FILTER (WHERE vote = 'no-go') AS no_go_votes,
    min(due_date) FILTER (WHERE vote IS NULL OR vote = 'pending') AS next_poll_due
  FROM public.polls GROUP BY acquisition_id
), auditagg AS (
  SELECT acquisition_id, count(*) AS audit_entries, max(logged_at) AS last_activity_at
  FROM public.audit_log WHERE acquisition_id IS NOT NULL GROUP BY acquisition_id
)
SELECT
  t.acquisition_id,
  t.title,
  t.pr_number,
  t.contract_number,
  t.center_code,
  t.branch_code,
  t.mission_id,
  m.name AS mission_name,
  m.milestone_date,
  t.acquisition_type,
  t.competition,
  t.contract_type,
  t.set_aside,
  t.naics_code,
  t.psc_code,
  t.estimated_value,
  t.co_name,
  t.requester_name,
  t.vendor_legal_name,
  t.current_phase,
  t.clock_state,
  t.status,
  t.source_tag,
  t.regulatory_baseline_date,
  t.target_award_date,
  t.need_date,
  t.period_of_performance_end,
  t.lead_to_delivery_days,
  (t.target_award_date - current_date) AS days_to_award,
  (t.need_date - current_date) AS days_to_need,
  pl.planned_days_to_award,
  (t.target_award_date + coalesce(t.lead_to_delivery_days, 0)) AS forecast_delivery_date,
  CASE WHEN m.milestone_date IS NULL OR t.target_award_date IS NULL THEN NULL
       ELSE m.milestone_date - (t.target_award_date + coalesce(t.lead_to_delivery_days, 0)) END AS schedule_impact_days,
  (t.clock_state = 'hold') AS on_hold,
  t.hold_reason,
  t.hold_owner,
  CASE WHEN t.hold_started_at IS NULL THEN NULL
       ELSE (current_date - t.hold_started_at::date) END AS hold_age_days,
  coalesce(pa.open_polls, 0) AS open_polls,
  coalesce(pa.no_go_votes, 0) AS no_go_votes,
  pa.next_poll_due,
  coalesce(aa.audit_entries, 0) AS audit_entries,
  aa.last_activity_at,
  CASE
    WHEN t.clock_state = 'launched' THEN 'Launched'
    WHEN t.clock_state = 'hold' THEN 'At Risk'
    WHEN m.milestone_date IS NOT NULL AND t.target_award_date IS NOT NULL
         AND m.milestone_date - (t.target_award_date + coalesce(t.lead_to_delivery_days, 0)) < 0 THEN 'At Risk'
    WHEN pa.next_poll_due IS NOT NULL AND pa.next_poll_due - current_date <= 3 THEN 'Needs Attention'
    ELSE 'On Track'
  END AS status_word
FROM typed t
LEFT JOIN public.missions m ON m.mission_id = t.mission_id
LEFT JOIN planned pl ON pl.acquisition_id = t.acquisition_id
LEFT JOIN pollagg pa ON pa.acquisition_id = t.acquisition_id
LEFT JOIN auditagg aa ON aa.acquisition_id = t.acquisition_id;

CREATE OR REPLACE VIEW public.v_report_holds
WITH (security_invoker = on) AS
SELECT
  a.acquisition_id,
  a.title,
  a.center_code,
  a.mission_id,
  a.current_phase,
  a.hold_reason,
  a.hold_owner,
  a.hold_started_at,
  (current_date - a.hold_started_at::date) AS hold_age_days,
  coalesce(c.aging_threshold_days, 5) AS aging_threshold_days,
  ((current_date - a.hold_started_at::date) >= coalesce(c.aging_threshold_days, 5)) AS aging
FROM public.acquisition_facts a
LEFT JOIN public.centers c ON c.center_code = a.center_code
WHERE a.clock_state = 'hold';

CREATE OR REPLACE VIEW public.v_report_polls
WITH (security_invoker = on) AS
SELECT
  p.poll_id,
  p.acquisition_id,
  a.title,
  a.center_code,
  p.phase,
  p.reviewer_role,
  p.reviewer_name,
  coalesce(p.vote, 'pending') AS vote,
  p.reason,
  p.due_date,
  p.opened_at,
  p.voted_at,
  CASE WHEN p.voted_at IS NULL THEN (current_date - p.opened_at::date) ELSE NULL END AS open_age_days,
  CASE WHEN p.voted_at IS NULL AND p.due_date IS NOT NULL THEN (p.due_date - current_date) ELSE NULL END AS days_to_due
FROM public.polls p
LEFT JOIN public.acquisition_facts a ON a.acquisition_id = p.acquisition_id;

CREATE OR REPLACE VIEW public.v_report_audit_counts
WITH (security_invoker = on) AS
SELECT
  l.acquisition_id,
  a.center_code,
  a.current_phase,
  count(*) AS entries,
  count(DISTINCT l.actor) AS actors,
  min(l.logged_at) AS first_entry_at,
  max(l.logged_at) AS last_entry_at
FROM public.audit_log l
LEFT JOIN public.acquisition_facts a ON a.acquisition_id = l.acquisition_id
GROUP BY l.acquisition_id, a.center_code, a.current_phase;

GRANT SELECT ON public.v_report_missions TO authenticated;
GRANT SELECT ON public.v_report_acquisitions TO authenticated;
GRANT SELECT ON public.v_report_holds TO authenticated;
GRANT SELECT ON public.v_report_polls TO authenticated;
GRANT SELECT ON public.v_report_audit_counts TO authenticated;
GRANT SELECT ON public.v_report_missions TO service_role;
GRANT SELECT ON public.v_report_acquisitions TO service_role;
GRANT SELECT ON public.v_report_holds TO service_role;
GRANT SELECT ON public.v_report_polls TO service_role;
GRANT SELECT ON public.v_report_audit_counts TO service_role;