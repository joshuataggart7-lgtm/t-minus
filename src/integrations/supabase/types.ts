export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acquisition_facts: {
        Row: {
          acquisition_forecast_verified: boolean | null
          acquisition_id: string
          acquisition_method: string | null
          backfill_source: Json | null
          branch_code: string | null
          center_code: string | null
          center_name: string | null
          clock_state: string | null
          co_code: string | null
          co_name: string | null
          commercial_determination: string | null
          competition: string | null
          contract_clauses: Json | null
          contract_format: string | null
          contract_number: string | null
          contract_type: string | null
          cor_name: string | null
          created_at: string
          created_by: string | null
          current_phase: string | null
          debriefing_date: string | null
          description_of_requirement: string | null
          enterprise_psl_check: string | null
          estimated_value: number | null
          funding_fiscal_year: string | null
          funds_certified: boolean | null
          hardware_deliverable: boolean | null
          hold_owner: string | null
          hold_reason: string | null
          hold_started_at: string | null
          hybrid_contract_type: string | null
          igce_attached: boolean | null
          includes_it: boolean | null
          intake_estimate: Json | null
          is_critical_path: boolean | null
          is_package_complete: boolean
          is_reimbursable: boolean
          is_seed: boolean
          jofoc_authority_citation: string | null
          lead_to_delivery_days: number | null
          mission_directorate_code: string | null
          mission_directorate_name: string | null
          mission_directorate_other: string | null
          mission_id: string | null
          naics_code: string | null
          need_date: string | null
          nf1707_answers: Json | null
          note: string | null
          period_of_performance_end: string | null
          period_of_performance_start: string | null
          place_of_performance: string | null
          place_of_performance_standardized: string | null
          post_award: Json
          pr_number: string | null
          proposed_price: number | null
          proposed_price_received: string | null
          psc_code: string | null
          psc_note: string | null
          regulatory_baseline_date: string | null
          requester_name: string | null
          requester_org_code: string | null
          responsibility_finding: string | null
          restrictive_clause_review: string | null
          right_to_repair_statement: boolean | null
          set_aside: string | null
          source_tag: string | null
          sow_attached: boolean | null
          sponsoring_agency: string | null
          status: string | null
          successor_of: string | null
          target_award_date: string | null
          title: string | null
          updated_at: string
          vendor_cage: string | null
          vendor_legal_name: string | null
          vendor_uei: string | null
        }
        Insert: {
          acquisition_forecast_verified?: boolean | null
          acquisition_id: string
          acquisition_method?: string | null
          backfill_source?: Json | null
          branch_code?: string | null
          center_code?: string | null
          center_name?: string | null
          clock_state?: string | null
          co_code?: string | null
          co_name?: string | null
          commercial_determination?: string | null
          competition?: string | null
          contract_clauses?: Json | null
          contract_format?: string | null
          contract_number?: string | null
          contract_type?: string | null
          cor_name?: string | null
          created_at?: string
          created_by?: string | null
          current_phase?: string | null
          debriefing_date?: string | null
          description_of_requirement?: string | null
          enterprise_psl_check?: string | null
          estimated_value?: number | null
          funding_fiscal_year?: string | null
          funds_certified?: boolean | null
          hardware_deliverable?: boolean | null
          hold_owner?: string | null
          hold_reason?: string | null
          hold_started_at?: string | null
          hybrid_contract_type?: string | null
          igce_attached?: boolean | null
          includes_it?: boolean | null
          intake_estimate?: Json | null
          is_critical_path?: boolean | null
          is_package_complete?: boolean
          is_reimbursable?: boolean
          is_seed?: boolean
          jofoc_authority_citation?: string | null
          lead_to_delivery_days?: number | null
          mission_directorate_code?: string | null
          mission_directorate_name?: string | null
          mission_directorate_other?: string | null
          mission_id?: string | null
          naics_code?: string | null
          need_date?: string | null
          nf1707_answers?: Json | null
          note?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          place_of_performance?: string | null
          place_of_performance_standardized?: string | null
          post_award?: Json
          pr_number?: string | null
          proposed_price?: number | null
          proposed_price_received?: string | null
          psc_code?: string | null
          psc_note?: string | null
          regulatory_baseline_date?: string | null
          requester_name?: string | null
          requester_org_code?: string | null
          responsibility_finding?: string | null
          restrictive_clause_review?: string | null
          right_to_repair_statement?: boolean | null
          set_aside?: string | null
          source_tag?: string | null
          sow_attached?: boolean | null
          sponsoring_agency?: string | null
          status?: string | null
          successor_of?: string | null
          target_award_date?: string | null
          title?: string | null
          updated_at?: string
          vendor_cage?: string | null
          vendor_legal_name?: string | null
          vendor_uei?: string | null
        }
        Update: {
          acquisition_forecast_verified?: boolean | null
          acquisition_id?: string
          acquisition_method?: string | null
          backfill_source?: Json | null
          branch_code?: string | null
          center_code?: string | null
          center_name?: string | null
          clock_state?: string | null
          co_code?: string | null
          co_name?: string | null
          commercial_determination?: string | null
          competition?: string | null
          contract_clauses?: Json | null
          contract_format?: string | null
          contract_number?: string | null
          contract_type?: string | null
          cor_name?: string | null
          created_at?: string
          created_by?: string | null
          current_phase?: string | null
          debriefing_date?: string | null
          description_of_requirement?: string | null
          enterprise_psl_check?: string | null
          estimated_value?: number | null
          funding_fiscal_year?: string | null
          funds_certified?: boolean | null
          hardware_deliverable?: boolean | null
          hold_owner?: string | null
          hold_reason?: string | null
          hold_started_at?: string | null
          hybrid_contract_type?: string | null
          igce_attached?: boolean | null
          includes_it?: boolean | null
          intake_estimate?: Json | null
          is_critical_path?: boolean | null
          is_package_complete?: boolean
          is_reimbursable?: boolean
          is_seed?: boolean
          jofoc_authority_citation?: string | null
          lead_to_delivery_days?: number | null
          mission_directorate_code?: string | null
          mission_directorate_name?: string | null
          mission_directorate_other?: string | null
          mission_id?: string | null
          naics_code?: string | null
          need_date?: string | null
          nf1707_answers?: Json | null
          note?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          place_of_performance?: string | null
          place_of_performance_standardized?: string | null
          post_award?: Json
          pr_number?: string | null
          proposed_price?: number | null
          proposed_price_received?: string | null
          psc_code?: string | null
          psc_note?: string | null
          regulatory_baseline_date?: string | null
          requester_name?: string | null
          requester_org_code?: string | null
          responsibility_finding?: string | null
          restrictive_clause_review?: string | null
          right_to_repair_statement?: boolean | null
          set_aside?: string | null
          source_tag?: string | null
          sow_attached?: boolean | null
          sponsoring_agency?: string | null
          status?: string | null
          successor_of?: string | null
          target_award_date?: string | null
          title?: string | null
          updated_at?: string
          vendor_cage?: string | null
          vendor_legal_name?: string | null
          vendor_uei?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "acquisition_facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_report_missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "acquisition_facts_successor_of_fkey"
            columns: ["successor_of"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "acquisition_facts_successor_of_fkey"
            columns: ["successor_of"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "acquisition_facts_successor_of_fkey"
            columns: ["successor_of"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      announcement_acks: {
        Row: {
          acknowledged_at: string
          announcement_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          announcement_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          announcement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_acks_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["announcement_id"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_id: string
          audience_centers: string[] | null
          audience_roles: string[] | null
          body: string | null
          effective_from: string | null
          effective_until: string | null
          link: string | null
          posted_at: string
          posted_by: string | null
          requires_acknowledgment: boolean | null
          severity: string | null
          title: string
        }
        Insert: {
          announcement_id?: string
          audience_centers?: string[] | null
          audience_roles?: string[] | null
          body?: string | null
          effective_from?: string | null
          effective_until?: string | null
          link?: string | null
          posted_at?: string
          posted_by?: string | null
          requires_acknowledgment?: boolean | null
          severity?: string | null
          title: string
        }
        Update: {
          announcement_id?: string
          audience_centers?: string[] | null
          audience_roles?: string[] | null
          body?: string | null
          effective_from?: string | null
          effective_until?: string | null
          link?: string | null
          posted_at?: string
          posted_by?: string | null
          requires_acknowledgment?: boolean | null
          severity?: string | null
          title?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acquisition_id: string | null
          action: string | null
          actor: string | null
          field: string | null
          log_id: string
          logged_at: string
          new_value: string | null
          old_value: string | null
          phase: string | null
          reason: string | null
        }
        Insert: {
          acquisition_id?: string | null
          action?: string | null
          actor?: string | null
          field?: string | null
          log_id?: string
          logged_at?: string
          new_value?: string | null
          old_value?: string | null
          phase?: string | null
          reason?: string | null
        }
        Update: {
          acquisition_id?: string | null
          action?: string | null
          actor?: string | null
          field?: string | null
          log_id?: string
          logged_at?: string
          new_value?: string | null
          old_value?: string | null
          phase?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          branch_code: string
          branch_name: string
          center_code: string
        }
        Insert: {
          branch_code: string
          branch_name: string
          center_code: string
        }
        Update: {
          branch_code?: string
          branch_name?: string
          center_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_center_code_fkey"
            columns: ["center_code"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["center_code"]
          },
        ]
      }
      center_overrides: {
        Row: {
          center_code: string
          citation: string | null
          created_at: string
          effective_date: string
          kind: string
          note: string | null
          override_id: string
          set_by: string | null
          superseded_date: string | null
          target: string
          updated_at: string
          value: number | null
        }
        Insert: {
          center_code: string
          citation?: string | null
          created_at?: string
          effective_date?: string
          kind: string
          note?: string | null
          override_id?: string
          set_by?: string | null
          superseded_date?: string | null
          target: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          center_code?: string
          citation?: string | null
          created_at?: string
          effective_date?: string
          kind?: string
          note?: string | null
          override_id?: string
          set_by?: string | null
          superseded_date?: string | null
          target?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "center_overrides_center_code_fkey"
            columns: ["center_code"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["center_code"]
          },
        ]
      }
      centers: {
        Row: {
          address_line: string | null
          aging_threshold_days: number
          center_code: string
          center_name: string
        }
        Insert: {
          address_line?: string | null
          aging_threshold_days?: number
          center_code: string
          center_name: string
        }
        Update: {
          address_line?: string | null
          aging_threshold_days?: number
          center_code?: string
          center_name?: string
        }
        Relationships: []
      }
      clause_matrix_2603b: {
        Row: {
          codified_number: string | null
          disposition: string | null
          effective_date: string | null
          name: string | null
          nasa_date_post_rfo: string | null
          notes: string | null
          p_or_c: string | null
          prescribed_in: string | null
          rfo_number: string | null
          rfo_rx: string | null
          rfo_title: string | null
          row_id: string
        }
        Insert: {
          codified_number?: string | null
          disposition?: string | null
          effective_date?: string | null
          name?: string | null
          nasa_date_post_rfo?: string | null
          notes?: string | null
          p_or_c?: string | null
          prescribed_in?: string | null
          rfo_number?: string | null
          rfo_rx?: string | null
          rfo_title?: string | null
          row_id?: string
        }
        Update: {
          codified_number?: string | null
          disposition?: string | null
          effective_date?: string | null
          name?: string | null
          nasa_date_post_rfo?: string | null
          notes?: string | null
          p_or_c?: string | null
          prescribed_in?: string | null
          rfo_number?: string | null
          rfo_rx?: string | null
          rfo_title?: string | null
          row_id?: string
        }
        Relationships: []
      }
      clause_mod_tasks: {
        Row: {
          acquisition_id: string
          center_code: string | null
          change_kind: string
          change_source: string | null
          clause_number: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deadline_date: string | null
          is_seed: boolean
          note: string | null
          owner_name: string | null
          status: string
          task_id: string
        }
        Insert: {
          acquisition_id: string
          center_code?: string | null
          change_kind: string
          change_source?: string | null
          clause_number: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deadline_date?: string | null
          is_seed?: boolean
          note?: string | null
          owner_name?: string | null
          status?: string
          task_id?: string
        }
        Update: {
          acquisition_id?: string
          center_code?: string | null
          change_kind?: string
          change_source?: string | null
          clause_number?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deadline_date?: string | null
          is_seed?: boolean
          note?: string | null
          owner_name?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clause_mod_tasks_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "clause_mod_tasks_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "clause_mod_tasks_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      clauses: {
        Row: {
          applies_when: Json | null
          change_deadline: string | null
          clause_number: string
          disposition: string | null
          effective_date: string | null
          fill_ins: Json | null
          last_sync: string | null
          last_updated: string | null
          modification_required: boolean
          pcd_reference: string | null
          post_rfo_date: string | null
          prescription_citation: string | null
          rfo_number_or_pcd: string | null
          row_id: string
          source: string | null
          status: string | null
          title: string | null
          ucf_section: string | null
        }
        Insert: {
          applies_when?: Json | null
          change_deadline?: string | null
          clause_number: string
          disposition?: string | null
          effective_date?: string | null
          fill_ins?: Json | null
          last_sync?: string | null
          last_updated?: string | null
          modification_required?: boolean
          pcd_reference?: string | null
          post_rfo_date?: string | null
          prescription_citation?: string | null
          rfo_number_or_pcd?: string | null
          row_id?: string
          source?: string | null
          status?: string | null
          title?: string | null
          ucf_section?: string | null
        }
        Update: {
          applies_when?: Json | null
          change_deadline?: string | null
          clause_number?: string
          disposition?: string | null
          effective_date?: string | null
          fill_ins?: Json | null
          last_sync?: string | null
          last_updated?: string | null
          modification_required?: boolean
          pcd_reference?: string | null
          post_rfo_date?: string | null
          prescription_citation?: string | null
          rfo_number_or_pcd?: string | null
          row_id?: string
          source?: string | null
          status?: string | null
          title?: string | null
          ucf_section?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author: string | null
          body: string | null
          comment_id: string
          created_at: string
          document_id: string | null
        }
        Insert: {
          author?: string | null
          body?: string | null
          comment_id?: string
          created_at?: string
          document_id?: string | null
        }
        Update: {
          author?: string | null
          body?: string | null
          comment_id?: string
          created_at?: string
          document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      competition_authorities: {
        Row: {
          acquisition_method: string
          authority_id: string
          citation: string
          competition_type: string
          created_at: string
          description: string
          source_tier: string
        }
        Insert: {
          acquisition_method: string
          authority_id?: string
          citation: string
          competition_type: string
          created_at?: string
          description: string
          source_tier?: string
        }
        Update: {
          acquisition_method?: string
          authority_id?: string
          citation?: string
          competition_type?: string
          created_at?: string
          description?: string
          source_tier?: string
        }
        Relationships: []
      }
      deviation_requests: {
        Row: {
          acquisition_id: string | null
          center_code: string | null
          citation: string
          clock_started_at: string | null
          clock_state: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          deviation_id: string
          deviation_type: string
          justification: string | null
          need_date: string | null
          proposed_text: string | null
          regulation_text: string | null
          requester_name: string
          status: string
          target_decision_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acquisition_id?: string | null
          center_code?: string | null
          citation: string
          clock_started_at?: string | null
          clock_state?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          deviation_id?: string
          deviation_type?: string
          justification?: string | null
          need_date?: string | null
          proposed_text?: string | null
          regulation_text?: string | null
          requester_name: string
          status?: string
          target_decision_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acquisition_id?: string | null
          center_code?: string | null
          citation?: string
          clock_started_at?: string | null
          clock_state?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          deviation_id?: string
          deviation_type?: string
          justification?: string | null
          need_date?: string | null
          proposed_text?: string | null
          regulation_text?: string | null
          requester_name?: string
          status?: string
          target_decision_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_requests_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "deviation_requests_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "deviation_requests_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      deviation_votes: {
        Row: {
          created_at: string
          deviation_id: string
          due_date: string | null
          reason: string | null
          reviewer_name: string | null
          reviewer_role: string
          updated_at: string
          vote: string | null
          vote_id: string
          voted_at: string | null
        }
        Insert: {
          created_at?: string
          deviation_id: string
          due_date?: string | null
          reason?: string | null
          reviewer_name?: string | null
          reviewer_role: string
          updated_at?: string
          vote?: string | null
          vote_id?: string
          voted_at?: string | null
        }
        Update: {
          created_at?: string
          deviation_id?: string
          due_date?: string | null
          reason?: string | null
          reviewer_name?: string | null
          reviewer_role?: string
          updated_at?: string
          vote?: string | null
          vote_id?: string
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deviation_votes_deviation_id_fkey"
            columns: ["deviation_id"]
            isOneToOne: false
            referencedRelation: "deviation_requests"
            referencedColumns: ["deviation_id"]
          },
        ]
      }
      document_attachments: {
        Row: {
          acquisition_id: string
          attachment_id: string
          content_type: string | null
          created_at: string
          doc_key: string
          doc_label: string
          file_name: string
          is_seed: boolean
          nf_1098_tab: string | null
          parsed_total: number | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          acquisition_id: string
          attachment_id?: string
          content_type?: string | null
          created_at?: string
          doc_key: string
          doc_label: string
          file_name: string
          is_seed?: boolean
          nf_1098_tab?: string | null
          parsed_total?: number | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          acquisition_id?: string
          attachment_id?: string
          content_type?: string | null
          created_at?: string
          doc_key?: string
          doc_label?: string
          file_name?: string
          is_seed?: boolean
          nf_1098_tab?: string | null
          parsed_total?: number | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "document_attachments_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "document_attachments_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      document_checkouts: {
        Row: {
          acquisition_id: string
          checked_out_at: string
          checkout_id: string
          created_at: string
          released_at: string | null
          template_key: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          acquisition_id: string
          checked_out_at?: string
          checkout_id?: string
          created_at?: string
          released_at?: string | null
          template_key: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          acquisition_id?: string
          checked_out_at?: string
          checkout_id?: string
          created_at?: string
          released_at?: string | null
          template_key?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      document_shares: {
        Row: {
          acquisition_id: string | null
          created_at: string
          document_id: string
          document_version: number | null
          expires_at: string
          issued_by: string
          issued_by_user_id: string | null
          last_opened_at: string | null
          magic_link_note: string | null
          magic_link_sent: boolean
          open_count: number
          recipient_email: string
          recipient_name: string | null
          revoked_at: string | null
          revoked_by: string | null
          share_id: string
          template_name: string
          token: string
          updated_at: string
        }
        Insert: {
          acquisition_id?: string | null
          created_at?: string
          document_id: string
          document_version?: number | null
          expires_at: string
          issued_by: string
          issued_by_user_id?: string | null
          last_opened_at?: string | null
          magic_link_note?: string | null
          magic_link_sent?: boolean
          open_count?: number
          recipient_email: string
          recipient_name?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          share_id?: string
          template_name: string
          token: string
          updated_at?: string
        }
        Update: {
          acquisition_id?: string | null
          created_at?: string
          document_id?: string
          document_version?: number | null
          expires_at?: string
          issued_by?: string
          issued_by_user_id?: string | null
          last_opened_at?: string | null
          magic_link_note?: string | null
          magic_link_sent?: boolean
          open_count?: number
          recipient_email?: string
          recipient_name?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          share_id?: string
          template_name?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      documents: {
        Row: {
          acquisition_id: string | null
          ai_generated_at: string | null
          ai_model: string | null
          created_by: string | null
          document_id: string
          field_values: Json | null
          is_seed: boolean
          issue_on_nf1858: boolean | null
          memo_header: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          saved_at: string | null
          saved_by: string | null
          template_id: string | null
          version: number | null
        }
        Insert: {
          acquisition_id?: string | null
          ai_generated_at?: string | null
          ai_model?: string | null
          created_by?: string | null
          document_id?: string
          field_values?: Json | null
          is_seed?: boolean
          issue_on_nf1858?: boolean | null
          memo_header?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          saved_at?: string | null
          saved_by?: string | null
          template_id?: string | null
          version?: number | null
        }
        Update: {
          acquisition_id?: string | null
          ai_generated_at?: string | null
          ai_model?: string | null
          created_by?: string | null
          document_id?: string
          field_values?: Json | null
          is_seed?: boolean
          issue_on_nf1858?: boolean | null
          memo_header?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          saved_at?: string | null
          saved_by?: string | null
          template_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "documents_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "documents_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      enterprise_strategies: {
        Row: {
          applies: string | null
          buying_location: string | null
          mandatory_vehicles: string | null
          name: string | null
          psl: string
          required_coordination: string | null
        }
        Insert: {
          applies?: string | null
          buying_location?: string | null
          mandatory_vehicles?: string | null
          name?: string | null
          psl: string
          required_coordination?: string | null
        }
        Update: {
          applies?: string | null
          buying_location?: string | null
          mandatory_vehicles?: string | null
          name?: string | null
          psl?: string
          required_coordination?: string | null
        }
        Relationships: []
      }
      igce_clins: {
        Row: {
          acquisition_id: string
          clin_id: string
          clin_number: string
          created_at: string
          created_by: string | null
          description: string
          extended_price: number | null
          is_seed: boolean
          period_end: string | null
          period_start: string | null
          quantity: number | null
          unit_of_issue: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          acquisition_id: string
          clin_id?: string
          clin_number: string
          created_at?: string
          created_by?: string | null
          description: string
          extended_price?: number | null
          is_seed?: boolean
          period_end?: string | null
          period_start?: string | null
          quantity?: number | null
          unit_of_issue?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          acquisition_id?: string
          clin_id?: string
          clin_number?: string
          created_at?: string
          created_by?: string | null
          description?: string
          extended_price?: number | null
          is_seed?: boolean
          period_end?: string | null
          period_start?: string | null
          quantity?: number | null
          unit_of_issue?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igce_clins_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "igce_clins_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "igce_clins_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      memo_routing: {
        Row: {
          approving_official_title: string
          center_code: string
          document_key: string
          memo_default: boolean | null
          note: string | null
          routing_id: string
          thru_chain: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approving_official_title: string
          center_code: string
          document_key: string
          memo_default?: boolean | null
          note?: string | null
          routing_id?: string
          thru_chain?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approving_official_title?: string
          center_code?: string
          document_key?: string
          memo_default?: boolean | null
          note?: string | null
          routing_id?: string
          thru_chain?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      missions: {
        Row: {
          center_code: string | null
          leadership_note: string | null
          milestone: string | null
          milestone_date: string | null
          mission_directorate_code: string | null
          mission_directorate_name: string | null
          mission_id: string
          name: string
          priority: number | null
          program: string | null
          program_owner: string | null
        }
        Insert: {
          center_code?: string | null
          leadership_note?: string | null
          milestone?: string | null
          milestone_date?: string | null
          mission_directorate_code?: string | null
          mission_directorate_name?: string | null
          mission_id: string
          name: string
          priority?: number | null
          program?: string | null
          program_owner?: string | null
        }
        Update: {
          center_code?: string | null
          leadership_note?: string | null
          milestone?: string | null
          milestone_date?: string | null
          mission_directorate_code?: string | null
          mission_directorate_name?: string | null
          mission_id?: string
          name?: string
          priority?: number | null
          program?: string | null
          program_owner?: string | null
        }
        Relationships: []
      }
      naics_size_standards: {
        Row: {
          citation: string | null
          effective_date: string | null
          employees: number | null
          naics_code: string
          naics_title: string | null
          note: string | null
          receipts_usd: number | null
          standard_type: string
        }
        Insert: {
          citation?: string | null
          effective_date?: string | null
          employees?: number | null
          naics_code: string
          naics_title?: string | null
          note?: string | null
          receipts_usd?: number | null
          standard_type: string
        }
        Update: {
          citation?: string | null
          effective_date?: string | null
          employees?: number | null
          naics_code?: string
          naics_title?: string | null
          note?: string | null
          receipts_usd?: number | null
          standard_type?: string
        }
        Relationships: []
      }
      nf1707_approvals: {
        Row: {
          acquisition_id: string
          approval_id: string
          approval_role: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string | null
          form_field_name: string
          form_section: string
          note: string | null
          owner_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acquisition_id: string
          approval_id?: string
          approval_role: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          form_field_name: string
          form_section: string
          note?: string | null
          owner_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition_id?: string
          approval_id?: string
          approval_role?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string | null
          form_field_name?: string
          form_section?: string
          note?: string | null
          owner_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nf1707_approvals_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "nf1707_approvals_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "nf1707_approvals_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      nf1707_fields: {
        Row: {
          caption: string | null
          caption_full: string | null
          center_specific: string | null
          choice_items: string | null
          field_id: string
          field_kind: string | null
          field_name: string | null
          is_answerable: string | null
          nearest_form_text: string | null
          nearest_form_text_full: string | null
          section: string | null
          subform: string | null
        }
        Insert: {
          caption?: string | null
          caption_full?: string | null
          center_specific?: string | null
          choice_items?: string | null
          field_id?: string
          field_kind?: string | null
          field_name?: string | null
          is_answerable?: string | null
          nearest_form_text?: string | null
          nearest_form_text_full?: string | null
          section?: string | null
          subform?: string | null
        }
        Update: {
          caption?: string | null
          caption_full?: string | null
          center_specific?: string | null
          choice_items?: string | null
          field_id?: string
          field_kind?: string | null
          field_name?: string | null
          is_answerable?: string | null
          nearest_form_text?: string | null
          nearest_form_text_full?: string | null
          section?: string | null
          subform?: string | null
        }
        Relationships: []
      }
      nfs_clause_matrix: {
        Row: {
          app_dev: string | null
          applicability: Json | null
          clause_date: string | null
          clause_number: string | null
          fill_in: string | null
          ibr_or_ft: string | null
          mod_or_sub: string | null
          prescribed_in: string | null
          provision_or_clause: string | null
          row_id: string
          title: string | null
          ucf: string | null
        }
        Insert: {
          app_dev?: string | null
          applicability?: Json | null
          clause_date?: string | null
          clause_number?: string | null
          fill_in?: string | null
          ibr_or_ft?: string | null
          mod_or_sub?: string | null
          prescribed_in?: string | null
          provision_or_clause?: string | null
          row_id?: string
          title?: string | null
          ucf?: string | null
        }
        Update: {
          app_dev?: string | null
          applicability?: Json | null
          clause_date?: string | null
          clause_number?: string | null
          fill_in?: string | null
          ibr_or_ft?: string | null
          mod_or_sub?: string | null
          prescribed_in?: string | null
          provision_or_clause?: string | null
          row_id?: string
          title?: string | null
          ucf?: string | null
        }
        Relationships: []
      }
      phase_plan: {
        Row: {
          acquisition_type: string
          note: string | null
          order: number | null
          phase: string
          plan_id: string
          planned_days: number | null
        }
        Insert: {
          acquisition_type: string
          note?: string | null
          order?: number | null
          phase: string
          plan_id?: string
          planned_days?: number | null
        }
        Update: {
          acquisition_type?: string
          note?: string | null
          order?: number | null
          phase?: string
          plan_id?: string
          planned_days?: number | null
        }
        Relationships: []
      }
      polls: {
        Row: {
          acquisition_id: string | null
          due_date: string | null
          opened_at: string
          phase: string | null
          poll_id: string
          reason: string | null
          reviewer_name: string | null
          reviewer_role: string | null
          vote: string | null
          voted_at: string | null
        }
        Insert: {
          acquisition_id?: string | null
          due_date?: string | null
          opened_at?: string
          phase?: string | null
          poll_id?: string
          reason?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          vote?: string | null
          voted_at?: string | null
        }
        Update: {
          acquisition_id?: string | null
          due_date?: string | null
          opened_at?: string
          phase?: string | null
          poll_id?: string
          reason?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          vote?: string | null
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "polls_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "polls_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_admin: boolean
          last_center_code: string | null
          last_organization_code: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_admin?: boolean
          last_center_code?: string | null
          last_organization_code?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean
          last_center_code?: string | null
          last_organization_code?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_refs: {
        Row: {
          applies_to_phase: string | null
          citation: string
          effective_date: string | null
          far_part: string | null
          nfs_part: string | null
          ref_id: string
          source: string | null
          tier: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          applies_to_phase?: string | null
          citation: string
          effective_date?: string | null
          far_part?: string | null
          nfs_part?: string | null
          ref_id?: string
          source?: string | null
          tier?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          applies_to_phase?: string | null
          citation?: string
          effective_date?: string | null
          far_part?: string | null
          nfs_part?: string | null
          ref_id?: string
          source?: string | null
          tier?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      research_findings: {
        Row: {
          acquisition_id: string
          confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          finding_id: string
          label: string
          run_id: string | null
          source: string
          source_date: string | null
          target: string
          value: string
        }
        Insert: {
          acquisition_id: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          finding_id?: string
          label: string
          run_id?: string | null
          source: string
          source_date?: string | null
          target: string
          value: string
        }
        Update: {
          acquisition_id?: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          finding_id?: string
          label?: string
          run_id?: string | null
          source?: string
          source_date?: string | null
          target?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      research_log: {
        Row: {
          acquisition_id: string
          log_id: string
          outcome: string
          query: string
          ran_at: string
          result_count: number | null
          run_id: string
          source: string
        }
        Insert: {
          acquisition_id: string
          log_id?: string
          outcome: string
          query: string
          ran_at?: string
          result_count?: number | null
          run_id: string
          source: string
        }
        Update: {
          acquisition_id?: string
          log_id?: string
          outcome?: string
          query?: string
          ran_at?: string
          result_count?: number | null
          run_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      research_runs: {
        Row: {
          acquisition_id: string
          acquisition_method: string | null
          naics_code: string | null
          psc_code: string | null
          ran_at: string
          ran_by: string | null
          run_id: string
          state_code: string | null
        }
        Insert: {
          acquisition_id: string
          acquisition_method?: string | null
          naics_code?: string | null
          psc_code?: string | null
          ran_at?: string
          ran_by?: string | null
          run_id?: string
          state_code?: string | null
        }
        Update: {
          acquisition_id?: string
          acquisition_method?: string | null
          naics_code?: string | null
          psc_code?: string | null
          ran_at?: string
          ran_by?: string | null
          run_id?: string
          state_code?: string | null
        }
        Relationships: []
      }
      review_rules: {
        Row: {
          citation: string | null
          note: string | null
          planned_days: number | null
          reviewer_role: string
          rule_id: string
          trigger: string | null
        }
        Insert: {
          citation?: string | null
          note?: string | null
          planned_days?: number | null
          reviewer_role: string
          rule_id?: string
          trigger?: string | null
        }
        Update: {
          citation?: string | null
          note?: string | null
          planned_days?: number | null
          reviewer_role?: string
          rule_id?: string
          trigger?: string | null
        }
        Relationships: []
      }
      sam_checks: {
        Row: {
          acquisition_id: string | null
          check_id: string
          check_type: string | null
          checked_at: string | null
          checked_by: string | null
          response_json: Json | null
          vendor_uei: string | null
        }
        Insert: {
          acquisition_id?: string | null
          check_id?: string
          check_type?: string | null
          checked_at?: string | null
          checked_by?: string | null
          response_json?: Json | null
          vendor_uei?: string | null
        }
        Update: {
          acquisition_id?: string | null
          check_id?: string
          check_type?: string | null
          checked_at?: string | null
          checked_by?: string | null
          response_json?: Json | null
          vendor_uei?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_checks_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "sam_checks_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "sam_checks_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
      template_defects: {
        Row: {
          acquisition_id: string | null
          citation: string | null
          correction: string | null
          created_at: string
          defect: string
          defect_id: string
          reported_at: string
          reporter_name: string
          reporter_role: string | null
          revision: string | null
          status: string
          template_key: string
          template_name: string
          updated_at: string
        }
        Insert: {
          acquisition_id?: string | null
          citation?: string | null
          correction?: string | null
          created_at?: string
          defect: string
          defect_id?: string
          reported_at?: string
          reporter_name: string
          reporter_role?: string | null
          revision?: string | null
          status?: string
          template_key: string
          template_name: string
          updated_at?: string
        }
        Update: {
          acquisition_id?: string | null
          citation?: string | null
          correction?: string | null
          created_at?: string
          defect?: string
          defect_id?: string
          reported_at?: string
          reporter_name?: string
          reporter_role?: string | null
          revision?: string | null
          status?: string
          template_key?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          applies_when: Json | null
          citation_tier: string | null
          governing_citation: string | null
          hq_revision_date: string | null
          html_source: string | null
          name: string
          nf_1098_tab: string | null
          status: string | null
          template_id: string
        }
        Insert: {
          applies_when?: Json | null
          citation_tier?: string | null
          governing_citation?: string | null
          hq_revision_date?: string | null
          html_source?: string | null
          name: string
          nf_1098_tab?: string | null
          status?: string | null
          template_id?: string
        }
        Update: {
          applies_when?: Json | null
          citation_tier?: string | null
          governing_citation?: string | null
          hq_revision_date?: string | null
          html_source?: string | null
          name?: string
          nf_1098_tab?: string | null
          status?: string | null
          template_id?: string
        }
        Relationships: []
      }
      thresholds: {
        Row: {
          citation: string | null
          effective_date: string | null
          name: string
          note: string | null
          superseded_date: string | null
          threshold_id: string
          tier: string | null
          value: number | null
        }
        Insert: {
          citation?: string | null
          effective_date?: string | null
          name: string
          note?: string | null
          superseded_date?: string | null
          threshold_id?: string
          tier?: string | null
          value?: number | null
        }
        Update: {
          citation?: string | null
          effective_date?: string | null
          name?: string
          note?: string | null
          superseded_date?: string | null
          threshold_id?: string
          tier?: string | null
          value?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          branch_code: string | null
          center_code: string | null
          created_at: string
          email: string | null
          name: string
          role: string
          supervisor_email: string | null
          supervisor_name: string | null
          telephone: string | null
          title: string | null
          user_id: string
          warrant_limit: number | null
        }
        Insert: {
          branch_code?: string | null
          center_code?: string | null
          created_at?: string
          email?: string | null
          name: string
          role: string
          supervisor_email?: string | null
          supervisor_name?: string | null
          telephone?: string | null
          title?: string | null
          user_id: string
          warrant_limit?: number | null
        }
        Update: {
          branch_code?: string | null
          center_code?: string | null
          created_at?: string
          email?: string | null
          name?: string
          role?: string
          supervisor_email?: string | null
          supervisor_name?: string | null
          telephone?: string | null
          title?: string | null
          user_id?: string
          warrant_limit?: number | null
        }
        Relationships: []
      }
      watch_items: {
        Row: {
          agency: string | null
          change_deadline: string | null
          decided_or_published_date: string | null
          external_id: string | null
          fetched_at: string | null
          item_id: string
          modification_required: boolean
          outcome_or_type: string | null
          source: string | null
          summary: string | null
          tags: string[] | null
          title: string | null
          url: string | null
        }
        Insert: {
          agency?: string | null
          change_deadline?: string | null
          decided_or_published_date?: string | null
          external_id?: string | null
          fetched_at?: string | null
          item_id?: string
          modification_required?: boolean
          outcome_or_type?: string | null
          source?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          url?: string | null
        }
        Update: {
          agency?: string | null
          change_deadline?: string | null
          decided_or_published_date?: string | null
          external_id?: string | null
          fetched_at?: string | null
          item_id?: string
          modification_required?: boolean
          outcome_or_type?: string | null
          source?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_report_acquisitions: {
        Row: {
          acquisition_id: string | null
          acquisition_type: string | null
          audit_entries: number | null
          branch_code: string | null
          center_code: string | null
          clock_state: string | null
          co_name: string | null
          competition: string | null
          contract_number: string | null
          contract_type: string | null
          current_phase: string | null
          days_to_award: number | null
          days_to_need: number | null
          estimated_value: number | null
          forecast_delivery_date: string | null
          hold_age_days: number | null
          hold_owner: string | null
          hold_reason: string | null
          last_activity_at: string | null
          lead_to_delivery_days: number | null
          milestone_date: string | null
          mission_id: string | null
          mission_name: string | null
          naics_code: string | null
          need_date: string | null
          next_poll_due: string | null
          no_go_votes: number | null
          on_hold: boolean | null
          open_polls: number | null
          period_of_performance_end: string | null
          planned_days_to_award: number | null
          pr_number: string | null
          psc_code: string | null
          regulatory_baseline_date: string | null
          requester_name: string | null
          schedule_impact_days: number | null
          set_aside: string | null
          source_tag: string | null
          status: string | null
          status_word: string | null
          target_award_date: string | null
          title: string | null
          vendor_legal_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "acquisition_facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_report_missions"
            referencedColumns: ["mission_id"]
          },
        ]
      }
      v_report_audit_counts: {
        Row: {
          acquisition_id: string | null
          actors: number | null
          center_code: string | null
          current_phase: string | null
          entries: number | null
          first_entry_at: string | null
          last_entry_at: string | null
        }
        Relationships: []
      }
      v_report_holds: {
        Row: {
          acquisition_id: string | null
          aging: boolean | null
          aging_threshold_days: number | null
          center_code: string | null
          current_phase: string | null
          hold_age_days: number | null
          hold_owner: string | null
          hold_reason: string | null
          hold_started_at: string | null
          mission_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "acquisition_facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_report_missions"
            referencedColumns: ["mission_id"]
          },
        ]
      }
      v_report_missions: {
        Row: {
          acquisition_count: number | null
          center_code: string | null
          days_to_milestone: number | null
          launched_count: number | null
          milestone: string | null
          milestone_date: string | null
          mission_id: string | null
          mission_name: string | null
          on_hold_count: number | null
          priority: number | null
          program: string | null
          program_owner: string | null
        }
        Relationships: []
      }
      v_report_polls: {
        Row: {
          acquisition_id: string | null
          center_code: string | null
          days_to_due: number | null
          due_date: string | null
          open_age_days: number | null
          opened_at: string | null
          phase: string | null
          poll_id: string | null
          reason: string | null
          reviewer_name: string | null
          reviewer_role: string | null
          title: string | null
          vote: string | null
          voted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisition_facts"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "polls_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_acquisitions"
            referencedColumns: ["acquisition_id"]
          },
          {
            foreignKeyName: "polls_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "v_report_holds"
            referencedColumns: ["acquisition_id"]
          },
        ]
      }
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hq: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "administrator"
        | "executive"
        | "specialist"
        | "reviewer"
        | "requester"
        | "hq"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "administrator",
        "executive",
        "specialist",
        "reviewer",
        "requester",
        "hq",
      ],
    },
  },
} as const
