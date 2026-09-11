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
          branch_code: string | null
          center_code: string | null
          clock_state: string | null
          co_code: string | null
          co_name: string | null
          commercial_determination: string | null
          competition: string | null
          contract_format: string | null
          contract_type: string | null
          cor_name: string | null
          created_at: string
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
          igce_attached: boolean | null
          includes_it: boolean | null
          intake_estimate: Json | null
          is_critical_path: boolean | null
          jofoc_authority_citation: string | null
          lead_to_delivery_days: number | null
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
          psc_code: string | null
          psc_note: string | null
          regulatory_baseline_date: string | null
          requester_name: string | null
          requester_org_code: string | null
          responsibility_finding: string | null
          restrictive_clause_review: string | null
          right_to_repair_statement: boolean | null
          set_aside: string | null
          sow_attached: boolean | null
          status: string | null
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
          branch_code?: string | null
          center_code?: string | null
          clock_state?: string | null
          co_code?: string | null
          co_name?: string | null
          commercial_determination?: string | null
          competition?: string | null
          contract_format?: string | null
          contract_type?: string | null
          cor_name?: string | null
          created_at?: string
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
          igce_attached?: boolean | null
          includes_it?: boolean | null
          intake_estimate?: Json | null
          is_critical_path?: boolean | null
          jofoc_authority_citation?: string | null
          lead_to_delivery_days?: number | null
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
          psc_code?: string | null
          psc_note?: string | null
          regulatory_baseline_date?: string | null
          requester_name?: string | null
          requester_org_code?: string | null
          responsibility_finding?: string | null
          restrictive_clause_review?: string | null
          right_to_repair_statement?: boolean | null
          set_aside?: string | null
          sow_attached?: boolean | null
          status?: string | null
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
          branch_code?: string | null
          center_code?: string | null
          clock_state?: string | null
          co_code?: string | null
          co_name?: string | null
          commercial_determination?: string | null
          competition?: string | null
          contract_format?: string | null
          contract_type?: string | null
          cor_name?: string | null
          created_at?: string
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
          igce_attached?: boolean | null
          includes_it?: boolean | null
          intake_estimate?: Json | null
          is_critical_path?: boolean | null
          jofoc_authority_citation?: string | null
          lead_to_delivery_days?: number | null
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
          psc_code?: string | null
          psc_note?: string | null
          regulatory_baseline_date?: string | null
          requester_name?: string | null
          requester_org_code?: string | null
          responsibility_finding?: string | null
          restrictive_clause_review?: string | null
          right_to_repair_statement?: boolean | null
          set_aside?: string | null
          sow_attached?: boolean | null
          status?: string | null
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
      centers: {
        Row: {
          center_code: string
          center_name: string
        }
        Insert: {
          center_code: string
          center_name: string
        }
        Update: {
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
      clauses: {
        Row: {
          applies_when: Json | null
          clause_number: string
          disposition: string | null
          effective_date: string | null
          fill_ins: Json | null
          last_sync: string | null
          last_updated: string | null
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
          clause_number: string
          disposition?: string | null
          effective_date?: string | null
          fill_ins?: Json | null
          last_sync?: string | null
          last_updated?: string | null
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
          clause_number?: string
          disposition?: string | null
          effective_date?: string | null
          fill_ins?: Json | null
          last_sync?: string | null
          last_updated?: string | null
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
          document_id: string
          field_values: Json | null
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
          document_id?: string
          field_values?: Json | null
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
          document_id?: string
          field_values?: Json | null
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
      missions: {
        Row: {
          center_code: string | null
          leadership_note: string | null
          milestone: string | null
          milestone_date: string | null
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
          mission_id?: string
          name?: string
          priority?: number | null
          program?: string | null
          program_owner?: string | null
        }
        Relationships: []
      }
      nf1707_fields: {
        Row: {
          caption: string | null
          center_specific: string | null
          field_id: string
          field_kind: string | null
          field_name: string | null
          nearest_form_text: string | null
          section: string | null
          subform: string | null
        }
        Insert: {
          caption?: string | null
          center_specific?: string | null
          field_id?: string
          field_kind?: string | null
          field_name?: string | null
          nearest_form_text?: string | null
          section?: string | null
          subform?: string | null
        }
        Update: {
          caption?: string | null
          center_specific?: string | null
          field_id?: string
          field_kind?: string | null
          field_name?: string | null
          nearest_form_text?: string | null
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
        ]
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
      users: {
        Row: {
          branch_code: string | null
          center_code: string | null
          created_at: string
          email: string | null
          name: string
          role: string
          title: string | null
          user_id: string
        }
        Insert: {
          branch_code?: string | null
          center_code?: string | null
          created_at?: string
          email?: string | null
          name: string
          role: string
          title?: string | null
          user_id: string
        }
        Update: {
          branch_code?: string | null
          center_code?: string | null
          created_at?: string
          email?: string | null
          name?: string
          role?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      watch_items: {
        Row: {
          agency: string | null
          decided_or_published_date: string | null
          external_id: string | null
          fetched_at: string | null
          item_id: string
          outcome_or_type: string | null
          source: string | null
          summary: string | null
          tags: string[] | null
          title: string | null
          url: string | null
        }
        Insert: {
          agency?: string | null
          decided_or_published_date?: string | null
          external_id?: string | null
          fetched_at?: string | null
          item_id?: string
          outcome_or_type?: string | null
          source?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          url?: string | null
        }
        Update: {
          agency?: string | null
          decided_or_published_date?: string | null
          external_id?: string | null
          fetched_at?: string | null
          item_id?: string
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
