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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance_policies: {
        Row: {
          created_at: string | null
          grace_period_minutes: number | null
          half_day_threshold_hours: number | null
          id: string
          is_active: boolean | null
          overtime_start_after_hours: number | null
          policy_name: string
          updated_at: string | null
          working_hours_per_day: number | null
        }
        Insert: {
          created_at?: string | null
          grace_period_minutes?: number | null
          half_day_threshold_hours?: number | null
          id?: string
          is_active?: boolean | null
          overtime_start_after_hours?: number | null
          policy_name: string
          updated_at?: string | null
          working_hours_per_day?: number | null
        }
        Update: {
          created_at?: string | null
          grace_period_minutes?: number | null
          half_day_threshold_hours?: number | null
          id?: string
          is_active?: boolean | null
          overtime_start_after_hours?: number | null
          policy_name?: string
          updated_at?: string | null
          working_hours_per_day?: number | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location_lat: number | null
          location_lng: number | null
          network_status: string | null
          notes: string | null
          sign_in_device_info: Json | null
          sign_in_location_accuracy: number | null
          sign_in_location_city: string | null
          sign_in_location_state: string | null
          sign_in_photo_url: string | null
          sign_in_time: string | null
          sign_out_device_info: Json | null
          sign_out_location_accuracy: number | null
          sign_out_location_city: string | null
          sign_out_location_state: string | null
          sign_out_photo_url: string | null
          sign_out_time: string | null
          status: string
          sync_status: string | null
          total_hours: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          network_status?: string | null
          notes?: string | null
          sign_in_device_info?: Json | null
          sign_in_location_accuracy?: number | null
          sign_in_location_city?: string | null
          sign_in_location_state?: string | null
          sign_in_photo_url?: string | null
          sign_in_time?: string | null
          sign_out_device_info?: Json | null
          sign_out_location_accuracy?: number | null
          sign_out_location_city?: string | null
          sign_out_location_state?: string | null
          sign_out_photo_url?: string | null
          sign_out_time?: string | null
          status?: string
          sync_status?: string | null
          total_hours?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          network_status?: string | null
          notes?: string | null
          sign_in_device_info?: Json | null
          sign_in_location_accuracy?: number | null
          sign_in_location_city?: string | null
          sign_in_location_state?: string | null
          sign_in_photo_url?: string | null
          sign_in_time?: string | null
          sign_out_device_info?: Json | null
          sign_out_location_accuracy?: number | null
          sign_out_location_city?: string | null
          sign_out_location_state?: string | null
          sign_out_photo_url?: string | null
          sign_out_time?: string | null
          status?: string
          sync_status?: string | null
          total_hours?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      attendance_regularizations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendance_date: string
          created_at: string
          id: string
          original_sign_in_time: string | null
          original_sign_out_time: string | null
          reason: string
          regularization_type: Database["public"]["Enums"]["regularization_type"]
          rejection_reason: string | null
          requested_sign_in_time: string | null
          requested_sign_out_time: string | null
          status: Database["public"]["Enums"]["regularization_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_date: string
          created_at?: string
          id?: string
          original_sign_in_time?: string | null
          original_sign_out_time?: string | null
          reason: string
          regularization_type: Database["public"]["Enums"]["regularization_type"]
          rejection_reason?: string | null
          requested_sign_in_time?: string | null
          requested_sign_out_time?: string | null
          status?: Database["public"]["Enums"]["regularization_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_date?: string
          created_at?: string
          id?: string
          original_sign_in_time?: string | null
          original_sign_out_time?: string | null
          reason?: string
          regularization_type?: Database["public"]["Enums"]["regularization_type"]
          rejection_reason?: string | null
          requested_sign_in_time?: string | null
          requested_sign_out_time?: string | null
          status?: Database["public"]["Enums"]["regularization_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_history: {
        Row: {
          backup_mode: string
          backup_type: string
          completed_at: string
          created_at: string
          id: string
          notes: string | null
          performed_by: string
          since_timestamp: string | null
          tables_exported: string[]
          total_rows_exported: number
        }
        Insert: {
          backup_mode?: string
          backup_type?: string
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by: string
          since_timestamp?: string | null
          tables_exported?: string[]
          total_rows_exported?: number
        }
        Update: {
          backup_mode?: string
          backup_type?: string
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string
          since_timestamp?: string | null
          tables_exported?: string[]
          total_rows_exported?: number
        }
        Relationships: []
      }
      bulk_import_history: {
        Row: {
          can_revert: boolean | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          current_batch: number | null
          error_log: Json | null
          failed_records: number | null
          file_name: string
          id: string
          processed_records: number | null
          reverted_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          successful_records: number | null
          table_name: string
          total_batches: number
          total_records: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_revert?: boolean | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          error_log?: Json | null
          failed_records?: number | null
          file_name: string
          id?: string
          processed_records?: number | null
          reverted_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          successful_records?: number | null
          table_name: string
          total_batches: number
          total_records: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_revert?: boolean | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          error_log?: Json | null
          failed_records?: number | null
          file_name?: string
          id?: string
          processed_records?: number | null
          reverted_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          successful_records?: number | null
          table_name?: string
          total_batches?: number
          total_records?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bulk_import_records: {
        Row: {
          created_at: string | null
          id: string
          import_id: string
          record_id: string
          row_number: number
          table_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          import_id: string
          record_id: string
          row_number: number
          table_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          import_id?: string
          record_id?: string
          row_number?: number
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_records_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      call_dispositions: {
        Row: {
          created_at: string | null
          disposition: string
          id: string
          is_active: boolean | null
          subdispositions: string[]
        }
        Insert: {
          created_at?: string | null
          disposition: string
          id?: string
          is_active?: boolean | null
          subdispositions?: string[]
        }
        Update: {
          created_at?: string | null
          disposition?: string
          id?: string
          is_active?: boolean | null
          subdispositions?: string[]
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_method: string | null
          call_sid: string
          conversation_duration: number | null
          created_at: string
          demandcom_id: string | null
          direction: string | null
          disposition: string | null
          disposition_set_at: string | null
          disposition_set_by: string | null
          edited_contact_info: Json | null
          end_time: string | null
          exotel_response: Json | null
          from_number: string
          id: string
          initiated_by: string | null
          notes: string | null
          recording_url: string | null
          start_time: string | null
          status: string
          subdisposition: string | null
          to_number: string
          updated_at: string
        }
        Insert: {
          call_method?: string | null
          call_sid: string
          conversation_duration?: number | null
          created_at?: string
          demandcom_id?: string | null
          direction?: string | null
          disposition?: string | null
          disposition_set_at?: string | null
          disposition_set_by?: string | null
          edited_contact_info?: Json | null
          end_time?: string | null
          exotel_response?: Json | null
          from_number: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          recording_url?: string | null
          start_time?: string | null
          status?: string
          subdisposition?: string | null
          to_number: string
          updated_at?: string
        }
        Update: {
          call_method?: string | null
          call_sid?: string
          conversation_duration?: number | null
          created_at?: string
          demandcom_id?: string | null
          direction?: string | null
          disposition?: string | null
          disposition_set_at?: string | null
          disposition_set_by?: string | null
          edited_contact_info?: Json | null
          end_time?: string | null
          exotel_response?: Json | null
          from_number?: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          recording_url?: string | null
          start_time?: string | null
          status?: string
          subdisposition?: string | null
          to_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_disposition_set_by_fkey"
            columns: ["disposition_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_links: {
        Row: {
          campaign_id: string
          click_count: number | null
          created_at: string
          id: string
          original_url: string
          short_code: string
        }
        Insert: {
          campaign_id: string
          click_count?: number | null
          created_at?: string
          id?: string
          original_url: string
          short_code: string
        }
        Update: {
          campaign_id?: string
          click_count?: number | null
          created_at?: string
          id?: string
          original_url?: string
          short_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          demandcom_id: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          demandcom_id?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          demandcom_id?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_data: Json | null
          bounced_count: number | null
          clicked_count: number | null
          created_at: string
          created_by: string | null
          delay_between_emails_ms: number | null
          delivered_count: number | null
          emails_per_minute: number | null
          filter_criteria: Json | null
          id: string
          name: string
          opened_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string | null
          template_id: string | null
          total_recipients: number | null
          type: string
          unsubscribed_count: number | null
          updated_at: string
        }
        Insert: {
          audience_data?: Json | null
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string
          created_by?: string | null
          delay_between_emails_ms?: number | null
          delivered_count?: number | null
          emails_per_minute?: number | null
          filter_criteria?: Json | null
          id?: string
          name: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          template_id?: string | null
          total_recipients?: number | null
          type: string
          unsubscribed_count?: number | null
          updated_at?: string
        }
        Update: {
          audience_data?: Json | null
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string
          created_by?: string | null
          delay_between_emails_ms?: number | null
          delivered_count?: number | null
          emails_per_minute?: number | null
          filter_criteria?: Json | null
          id?: string
          name?: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          template_id?: string | null
          total_recipients?: number | null
          type?: string
          unsubscribed_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          conversation_type: string
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          conversation_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          conversation_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_edited: boolean | null
          message_type: string
          project_task_id: string | null
          reply_to_id: string | null
          sender_id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_edited?: boolean | null
          message_type?: string
          project_task_id?: string | null
          reply_to_id?: string | null
          sender_id: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_edited?: boolean | null
          message_type?: string
          project_task_id?: string | null
          reply_to_id?: string | null
          sender_id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_project_task_id_fkey"
            columns: ["project_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "general_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean | null
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          anniversary_date: string | null
          birthday_date: string | null
          company_linkedin_page: string | null
          company_name: string
          contact_name: string
          contact_number: string | null
          created_at: string
          created_by: string | null
          email_id: string | null
          id: string
          linkedin_id: string | null
          official_address: string | null
          residence_address: string | null
          updated_at: string
        }
        Insert: {
          anniversary_date?: string | null
          birthday_date?: string | null
          company_linkedin_page?: string | null
          company_name: string
          contact_name: string
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          email_id?: string | null
          id?: string
          linkedin_id?: string | null
          official_address?: string | null
          residence_address?: string | null
          updated_at?: string
        }
        Update: {
          anniversary_date?: string | null
          birthday_date?: string | null
          company_linkedin_page?: string | null
          company_name?: string
          contact_name?: string
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          email_id?: string | null
          id?: string
          linkedin_id?: string | null
          official_address?: string | null
          residence_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_holidays: {
        Row: {
          applicable_locations: string[] | null
          created_at: string | null
          day_of_week: string | null
          holiday_date: string
          holiday_name: string
          id: string
          is_optional: boolean | null
          notes: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          applicable_locations?: string[] | null
          created_at?: string | null
          day_of_week?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
          is_optional?: boolean | null
          notes?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          applicable_locations?: string[] | null
          created_at?: string | null
          day_of_week?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
          is_optional?: boolean | null
          notes?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      crm_ticket_comments: {
        Row: {
          comment: string | null
          created_at: string | null
          created_by: string | null
          crm_ticket_id: string
          external_comment_id: string
          id: string
          is_internal: boolean | null
          org_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_ticket_id: string
          external_comment_id: string
          id?: string
          is_internal?: boolean | null
          org_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_ticket_id?: string
          external_comment_id?: string
          id?: string
          is_internal?: boolean | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_ticket_comments_crm_ticket_id_fkey"
            columns: ["crm_ticket_id"]
            isOneToOne: false
            referencedRelation: "crm_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ticket_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ticket_escalations: {
        Row: {
          attachments: Json | null
          created_at: string | null
          crm_ticket_id: string
          escalated_by: string | null
          escalated_to: string | null
          external_escalation_id: string
          id: string
          org_id: string | null
          remarks: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          crm_ticket_id: string
          escalated_by?: string | null
          escalated_to?: string | null
          external_escalation_id: string
          id?: string
          org_id?: string | null
          remarks?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          crm_ticket_id?: string
          escalated_by?: string | null
          escalated_to?: string | null
          external_escalation_id?: string
          id?: string
          org_id?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_ticket_escalations_crm_ticket_id_fkey"
            columns: ["crm_ticket_id"]
            isOneToOne: false
            referencedRelation: "crm_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ticket_escalations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ticket_history: {
        Row: {
          action: string | null
          changed_by: string | null
          created_at: string | null
          crm_ticket_id: string
          external_history_id: string
          id: string
          new_value: string | null
          old_value: string | null
          org_id: string | null
        }
        Insert: {
          action?: string | null
          changed_by?: string | null
          created_at?: string | null
          crm_ticket_id: string
          external_history_id: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string | null
        }
        Update: {
          action?: string | null
          changed_by?: string | null
          created_at?: string | null
          crm_ticket_id?: string
          external_history_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_ticket_history_crm_ticket_id_fkey"
            columns: ["crm_ticket_id"]
            isOneToOne: false
            referencedRelation: "crm_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ticket_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          external_ticket_id: string
          id: string
          org_id: string | null
          priority: string | null
          resolved_at: string | null
          source: string | null
          status: string | null
          subject: string | null
          ticket_number: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          external_ticket_id: string
          id?: string
          org_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          source?: string | null
          status?: string | null
          subject?: string | null
          ticket_number?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          external_ticket_id?: string
          id?: string
          org_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          source?: string | null
          status?: string | null
          subject?: string | null
          ticket_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      csbd_credit_allocations: {
        Row: {
          created_at: string
          created_by_user_id: string
          credit_to_user_id: string
          id: string
          percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          credit_to_user_id: string
          id?: string
          percentage: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          credit_to_user_id?: string
          id?: string
          percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "csbd_credit_allocations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csbd_credit_allocations_credit_to_user_id_fkey"
            columns: ["credit_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      csbd_projection_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          ip_address: string | null
          new_value: number | null
          old_value: number | null
          projection_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_value?: number | null
          old_value?: number | null
          projection_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_value?: number | null
          old_value?: number | null
          projection_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csbd_projection_audit_projection_id_fkey"
            columns: ["projection_id"]
            isOneToOne: false
            referencedRelation: "csbd_projections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csbd_projection_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      csbd_projections: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          month: string
          notes: string | null
          projection_amount_inr_lacs: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          month: string
          notes?: string | null
          projection_amount_inr_lacs: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          month?: string
          notes?: string | null
          projection_amount_inr_lacs?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csbd_projections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      csbd_targets: {
        Row: {
          annual_target_inr_lacs: number
          created_at: string | null
          created_by: string | null
          existing_business_target_inr_lacs: number | null
          fiscal_year: number
          has_subordinates: boolean | null
          id: string
          is_active: boolean | null
          new_business_target_inr_lacs: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annual_target_inr_lacs: number
          created_at?: string | null
          created_by?: string | null
          existing_business_target_inr_lacs?: number | null
          fiscal_year: number
          has_subordinates?: boolean | null
          id?: string
          is_active?: boolean | null
          new_business_target_inr_lacs?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annual_target_inr_lacs?: number
          created_at?: string | null
          created_by?: string | null
          existing_business_target_inr_lacs?: number | null
          fiscal_year?: number
          has_subordinates?: boolean | null
          id?: string
          is_active?: boolean | null
          new_business_target_inr_lacs?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csbd_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom: {
        Row: {
          activity_name: string | null
          address: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          assignment_status: string | null
          associated_member_linkedin: string | null
          city: string | null
          company_linkedin_url: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deppt: string | null
          designation: string | null
          emp_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          extra: string | null
          extra_1: string | null
          extra_2: string | null
          generic_email_id: string | null
          head_office_location: string | null
          id: string
          industry_type: string | null
          job_level_updated: string | null
          last_call_date: string | null
          latest_disposition: string | null
          latest_subdisposition: string | null
          linkedin: string | null
          location: string | null
          mobile_numb: string | null
          mobile2: string | null
          name: string | null
          next_call_date: string | null
          official: string | null
          personal_email_id: string | null
          pincode: string | null
          remarks: string | null
          salutation: string | null
          source: string | null
          source_1: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          turnover_link: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          activity_name?: string | null
          address?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_status?: string | null
          associated_member_linkedin?: string | null
          city?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          extra?: string | null
          extra_1?: string | null
          extra_2?: string | null
          generic_email_id?: string | null
          head_office_location?: string | null
          id?: string
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string | null
          mobile2?: string | null
          name?: string | null
          next_call_date?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          remarks?: string | null
          salutation?: string | null
          source?: string | null
          source_1?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          turnover_link?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          activity_name?: string | null
          address?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_status?: string | null
          associated_member_linkedin?: string | null
          city?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          extra?: string | null
          extra_1?: string | null
          extra_2?: string | null
          generic_email_id?: string | null
          head_office_location?: string | null
          id?: string
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string | null
          mobile2?: string | null
          name?: string | null
          next_call_date?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          remarks?: string | null
          salutation?: string | null
          source?: string | null
          source_1?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          turnover_link?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandcom_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom_backup_swap_20250129: {
        Row: {
          activity_name: string | null
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          deppt: string | null
          designation: string | null
          emp_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          generic_email_id: string | null
          id: string | null
          industry_type: string | null
          job_level_updated: string | null
          last_call_date: string | null
          latest_disposition: string | null
          latest_subdisposition: string | null
          linkedin: string | null
          location: string | null
          mobile_numb: string | null
          mobile2: string | null
          name: string | null
          official: string | null
          personal_email_id: string | null
          pincode: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          updated_at: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          activity_name?: string | null
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email_id?: string | null
          id?: string | null
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string | null
          mobile2?: string | null
          name?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          activity_name?: string | null
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email_id?: string | null
          id?: string | null
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string | null
          mobile2?: string | null
          name?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      demandcom_daily_performance: {
        Row: {
          company_info_updates: number | null
          contact_info_updates: number | null
          created_at: string | null
          disposition_company_closed: number | null
          disposition_cpnf: number | null
          disposition_fully_validate: number | null
          disposition_ivc: number | null
          disposition_lto: number | null
          disposition_partially_validate: number | null
          id: string
          location_info_updates: number | null
          other_field_updates: number | null
          performance_date: string
          total_disposition_changes: number | null
          total_records_updated: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_info_updates?: number | null
          contact_info_updates?: number | null
          created_at?: string | null
          disposition_company_closed?: number | null
          disposition_cpnf?: number | null
          disposition_fully_validate?: number | null
          disposition_ivc?: number | null
          disposition_lto?: number | null
          disposition_partially_validate?: number | null
          id?: string
          location_info_updates?: number | null
          other_field_updates?: number | null
          performance_date: string
          total_disposition_changes?: number | null
          total_records_updated?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_info_updates?: number | null
          contact_info_updates?: number | null
          created_at?: string | null
          disposition_company_closed?: number | null
          disposition_cpnf?: number | null
          disposition_fully_validate?: number | null
          disposition_ivc?: number | null
          disposition_lto?: number | null
          disposition_partially_validate?: number | null
          id?: string
          location_info_updates?: number | null
          other_field_updates?: number | null
          performance_date?: string
          total_disposition_changes?: number | null
          total_records_updated?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandcom_daily_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom_daily_targets: {
        Row: {
          call_target: number | null
          campaign_type: string
          created_at: string | null
          database_update_target: number | null
          id: string
          project_id: string | null
          registration_target: number | null
          set_by: string | null
          target_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          call_target?: number | null
          campaign_type: string
          created_at?: string | null
          database_update_target?: number | null
          id?: string
          project_id?: string | null
          registration_target?: number | null
          set_by?: string | null
          target_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          call_target?: number | null
          campaign_type?: string
          created_at?: string | null
          database_update_target?: number | null
          id?: string
          project_id?: string | null
          registration_target?: number | null
          set_by?: string | null
          target_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandcom_daily_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_daily_targets_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_daily_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom_field_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string | null
          demandcom_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string | null
          demandcom_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string | null
          demandcom_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandcom_field_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_field_changes_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_field_changes_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom_pipeline: {
        Row: {
          demandcom_id: string
          entered_at: string
          exited_at: string | null
          id: string
          is_current: boolean | null
          moved_by: string | null
          notes: string | null
          stage_id: string
        }
        Insert: {
          demandcom_id: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          is_current?: boolean | null
          moved_by?: string | null
          notes?: string | null
          stage_id: string
        }
        Update: {
          demandcom_id?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          is_current?: boolean | null
          moved_by?: string | null
          notes?: string | null
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_pipeline_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_pipeline_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_pipeline_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_pipeline_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_pipeline_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          id: string
          is_active: boolean | null
          level: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_activity_log: {
        Row: {
          bcc_emails: string[] | null
          cc_emails: string[] | null
          demandcom_id: string | null
          error_message: string | null
          from_email: string | null
          has_attachments: boolean | null
          id: string
          microsoft_message_id: string | null
          provider: string
          sent_at: string
          sent_by: string
          status: string
          subject: string | null
          template_id: string | null
          to_email: string
        }
        Insert: {
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          demandcom_id?: string | null
          error_message?: string | null
          from_email?: string | null
          has_attachments?: boolean | null
          id?: string
          microsoft_message_id?: string | null
          provider?: string
          sent_at?: string
          sent_by: string
          status?: string
          subject?: string | null
          template_id?: string | null
          to_email: string
        }
        Update: {
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          demandcom_id?: string | null
          error_message?: string | null
          from_email?: string | null
          has_attachments?: boolean | null
          id?: string
          microsoft_message_id?: string | null
          provider?: string
          sent_at?: string
          sent_by?: string
          status?: string
          subject?: string | null
          template_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_activity_log_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activity_log_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_activity_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          button_text: string | null
          button_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          facebook_url: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          is_active: boolean
          linkedin_url: string | null
          merge_tags: string[] | null
          name: string
          subject: string
          twitter_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          body_html: string
          body_text?: string | null
          button_text?: string | null
          button_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_active?: boolean
          linkedin_url?: string | null
          merge_tags?: string[] | null
          name: string
          subject: string
          twitter_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          body_html?: string
          body_text?: string | null
          button_text?: string | null
          button_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_active?: boolean
          linkedin_url?: string | null
          merge_tags?: string[] | null
          name?: string
          subject?: string
          twitter_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_type: string
          file_path: string
          file_size: number | null
          id: string
          notes: string | null
          updated_at: string | null
          uploaded_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_type: string
          file_path: string
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_type?: string
          file_path?: string
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      employee_personal_details: {
        Row: {
          aadhar_number: string | null
          blood_group: string | null
          created_at: string | null
          date_of_birth: string | null
          emergency_contact_number: string | null
          emergency_contact_person_name: string | null
          father_name: string | null
          gender: string | null
          id: string
          marital_status: string | null
          mobile_number_2: string | null
          mother_name: string | null
          passport_number: string | null
          permanent_address: string | null
          personal_email: string | null
          present_address: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aadhar_number?: string | null
          blood_group?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_number?: string | null
          emergency_contact_person_name?: string | null
          father_name?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          mobile_number_2?: string | null
          mother_name?: string | null
          passport_number?: string | null
          permanent_address?: string | null
          personal_email?: string | null
          present_address?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aadhar_number?: string | null
          blood_group?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_number?: string | null
          emergency_contact_person_name?: string | null
          father_name?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          mobile_number_2?: string | null
          mother_name?: string | null
          passport_number?: string | null
          permanent_address?: string | null
          personal_email?: string | null
          present_address?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_personal_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_details: {
        Row: {
          bank_account_number: string | null
          bank_name: string | null
          basic_salary: number | null
          conveyance_allowance: number | null
          created_at: string | null
          date_of_confirmation: string | null
          date_of_joining: string | null
          department: string | null
          designation: string | null
          effective_from: string | null
          employee_code: string | null
          employee_type: string | null
          epf_percentage: number | null
          esi_number: string | null
          esic_percentage: number | null
          hra: number | null
          id: string
          ifsc_code: string | null
          last_working_date: string | null
          location_city: string | null
          medical_allowance: number | null
          other_allowance: number | null
          pan_number: string | null
          pf_number: string | null
          professional_tax: number | null
          resignation_date: string | null
          special_allowance: number | null
          uan_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          conveyance_allowance?: number | null
          created_at?: string | null
          date_of_confirmation?: string | null
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          effective_from?: string | null
          employee_code?: string | null
          employee_type?: string | null
          epf_percentage?: number | null
          esi_number?: string | null
          esic_percentage?: number | null
          hra?: number | null
          id?: string
          ifsc_code?: string | null
          last_working_date?: string | null
          location_city?: string | null
          medical_allowance?: number | null
          other_allowance?: number | null
          pan_number?: string | null
          pf_number?: string | null
          professional_tax?: number | null
          resignation_date?: string | null
          special_allowance?: number | null
          uan_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          conveyance_allowance?: number | null
          created_at?: string | null
          date_of_confirmation?: string | null
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          effective_from?: string | null
          employee_code?: string | null
          employee_type?: string | null
          epf_percentage?: number | null
          esi_number?: string | null
          esic_percentage?: number | null
          hra?: number | null
          id?: string
          ifsc_code?: string | null
          last_working_date?: string | null
          location_city?: string | null
          medical_allowance?: number | null
          other_allowance?: number | null
          pan_number?: string | null
          pf_number?: string | null
          professional_tax?: number | null
          resignation_date?: string | null
          special_allowance?: number | null
          uan_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          event_type: string | null
          id: string
          image_url: string | null
          location: string | null
          start_time: string
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          start_time: string
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      exotel_config: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_name: string | null
          exophone: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          exophone: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          exophone?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      export_batches: {
        Row: {
          batch_number: number
          batch_size: number
          completed_at: string | null
          created_at: string | null
          csv_content: string | null
          error_message: string | null
          export_job_id: string
          id: string
          offset_start: number
          records_processed: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          batch_number: number
          batch_size: number
          completed_at?: string | null
          created_at?: string | null
          csv_content?: string | null
          error_message?: string | null
          export_job_id: string
          id?: string
          offset_start: number
          records_processed?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_number?: number
          batch_size?: number
          completed_at?: string | null
          created_at?: string | null
          csv_content?: string | null
          error_message?: string | null
          export_job_id?: string
          id?: string
          offset_start?: number
          records_processed?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_batches_export_job_id_fkey"
            columns: ["export_job_id"]
            isOneToOne: false
            referencedRelation: "export_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_batch: number | null
          error_message: string | null
          file_url: string | null
          filters: Json | null
          id: string
          processed_records: number | null
          source: string
          started_at: string | null
          status: string
          total_batches: number | null
          total_records: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          error_message?: string | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          processed_records?: number | null
          source: string
          started_at?: string | null
          status?: string
          total_batches?: number | null
          total_records?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          error_message?: string | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          processed_records?: number | null
          source?: string
          started_at?: string | null
          status?: string
          total_batches?: number | null
          total_records?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_announcements: {
        Row: {
          announcement_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_text: string | null
          link_url: string | null
          priority: string
          published_at: string | null
          target_roles: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_url?: string | null
          priority?: string
          published_at?: string | null
          target_roles?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_url?: string | null
          priority?: string
          published_at?: string | null
          target_roles?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      general_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          completion_file_name: string | null
          completion_file_path: string | null
          completion_files: Json | null
          completion_notes: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          parent_task_id: string | null
          priority: string | null
          restart_reason: string | null
          restarted_at: string | null
          restarted_by: string | null
          status: string
          task_name: string
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          completion_file_name?: string | null
          completion_file_path?: string | null
          completion_files?: Json | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          restart_reason?: string | null
          restarted_at?: string | null
          restarted_by?: string | null
          status?: string
          task_name: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          completion_file_name?: string | null
          completion_file_path?: string | null
          completion_files?: Json | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          restart_reason?: string | null
          restarted_at?: string | null
          restarted_by?: string | null
          status?: string
          task_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "general_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "general_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "general_tasks_restarted_by_fkey"
            columns: ["restarted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_policy_documents: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean | null
          mime_type: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          batch_number: number
          batch_size: number
          completed_at: string | null
          created_at: string | null
          error_details: Json | null
          id: string
          import_id: string
          offset_start: number
          records_failed: number | null
          records_inserted: number | null
          records_processed: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          batch_number: number
          batch_size: number
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          id?: string
          import_id: string
          offset_start: number
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_number?: number
          batch_size?: number
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          id?: string
          import_id?: string
          offset_start?: number
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      import_staging: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          import_id: string
          processed: boolean | null
          raw_data: Json
          row_number: number
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_id: string
          processed?: boolean | null
          raw_data: Json
          row_number: number
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_id?: string
          processed?: boolean | null
          raw_data?: Json
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_staging_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_allocations: {
        Row: {
          allocated_by: string | null
          allocated_condition: string
          allocation_date: string
          allocation_notes: string | null
          created_at: string | null
          deallocated_by: string | null
          deallocation_date: string | null
          expected_return_date: string | null
          id: string
          inventory_item_id: string
          return_notes: string | null
          returned_condition: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocated_by?: string | null
          allocated_condition: string
          allocation_date?: string
          allocation_notes?: string | null
          created_at?: string | null
          deallocated_by?: string | null
          deallocation_date?: string | null
          expected_return_date?: string | null
          id?: string
          inventory_item_id: string
          return_notes?: string | null
          returned_condition?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocated_by?: string | null
          allocated_condition?: string
          allocation_date?: string
          allocation_notes?: string | null
          created_at?: string | null
          deallocated_by?: string | null
          deallocation_date?: string | null
          expected_return_date?: string | null
          id?: string
          inventory_item_id?: string
          return_notes?: string | null
          returned_condition?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_deallocated_by_fkey"
            columns: ["deallocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audit_log: {
        Row: {
          action: string
          allocation_id: string | null
          changed_by: string | null
          id: string
          inventory_item_id: string
          new_condition: string | null
          new_status: string | null
          notes: string | null
          old_condition: string | null
          old_status: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          allocation_id?: string | null
          changed_by?: string | null
          id?: string
          inventory_item_id: string
          new_condition?: string | null
          new_status?: string | null
          notes?: string | null
          old_condition?: string | null
          old_status?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          allocation_id?: string | null
          changed_by?: string | null
          id?: string
          inventory_item_id?: string
          new_condition?: string | null
          new_status?: string | null
          notes?: string | null
          old_condition?: string | null
          old_status?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_log_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "inventory_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          current_condition: string | null
          date_of_purchase: string
          gst_amount: number | null
          gst_slab: number
          id: string
          imei: string | null
          inventory_type: string | null
          invoice_date: string
          invoice_file_url: string | null
          invoice_no: string
          item_description: string | null
          items: string
          line_number: number | null
          model: string | null
          parent_item_id: string | null
          payment_status: string | null
          quantity: number
          rate: number
          serial_number: string | null
          status: string | null
          total_cost: number | null
          total_price: number | null
          units: string
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_condition?: string | null
          date_of_purchase: string
          gst_amount?: number | null
          gst_slab?: number
          id?: string
          imei?: string | null
          inventory_type?: string | null
          invoice_date: string
          invoice_file_url?: string | null
          invoice_no: string
          item_description?: string | null
          items: string
          line_number?: number | null
          model?: string | null
          parent_item_id?: string | null
          payment_status?: string | null
          quantity: number
          rate: number
          serial_number?: string | null
          status?: string | null
          total_cost?: number | null
          total_price?: number | null
          units: string
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_condition?: string | null
          date_of_purchase?: string
          gst_amount?: number | null
          gst_slab?: number
          id?: string
          imei?: string | null
          inventory_type?: string | null
          invoice_date?: string
          invoice_file_url?: string | null
          invoice_no?: string
          item_description?: string | null
          items?: string
          line_number?: number | null
          model?: string | null
          parent_item_id?: string | null
          payment_status?: string | null
          quantity?: number
          rate?: number
          serial_number?: string | null
          status?: string | null
          total_cost?: number | null
          total_price?: number | null
          units?: string
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          excelhire_id: string | null
          id: string
          latitude: number | null
          license_required: string | null
          location_city: string | null
          location_state: string | null
          location_zip: string | null
          longitude: number | null
          salary_max: number | null
          salary_min: number | null
          specialty: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          excelhire_id?: string | null
          id?: string
          latitude?: number | null
          license_required?: string | null
          location_city?: string | null
          location_state?: string | null
          location_zip?: string | null
          longitude?: number | null
          salary_max?: number | null
          salary_min?: number | null
          specialty?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          excelhire_id?: string | null
          id?: string
          latitude?: number | null
          license_required?: string | null
          location_city?: string | null
          location_state?: string | null
          location_zip?: string | null
          longitude?: number | null
          salary_max?: number | null
          salary_min?: number | null
          specialty?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "master"
            referencedColumns: ["mobile_numb"]
          },
        ]
      }
      late_coming_records: {
        Row: {
          attendance_record_id: string | null
          created_at: string | null
          date: string
          expected_time: string | null
          id: string
          late_minutes: number
          month_year: string
          sign_in_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_record_id?: string | null
          created_at?: string | null
          date: string
          expected_time?: string | null
          id?: string
          late_minutes: number
          month_year: string
          sign_in_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_record_id?: string | null
          created_at?: string | null
          date?: string
          expected_time?: string | null
          id?: string
          late_minutes?: number
          month_year?: string
          sign_in_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_coming_records_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_applications: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          attachments: Json | null
          created_at: string | null
          end_date: string
          id: string
          leave_calculation: Json | null
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          sandwich_days: number | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          created_at?: string | null
          end_date: string
          id?: string
          leave_calculation?: Json | null
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason?: string | null
          sandwich_days?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          created_at?: string | null
          end_date?: string
          id?: string
          leave_calculation?: Json | null
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          rejection_reason?: string | null
          sandwich_days?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leave_balance_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_type: string
          created_at: string | null
          days: number
          id: string
          leave_type: string
          new_balance: number | null
          previous_balance: number | null
          reason: string
          user_id: string
          year: number
        }
        Insert: {
          adjusted_by: string
          adjustment_type: string
          created_at?: string | null
          days: number
          id?: string
          leave_type: string
          new_balance?: number | null
          previous_balance?: number | null
          reason: string
          user_id: string
          year: number
        }
        Update: {
          adjusted_by?: string
          adjustment_type?: string
          created_at?: string | null
          days?: number
          id?: string
          leave_type?: string
          new_balance?: number | null
          previous_balance?: number | null
          reason?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          casual_leave_balance: number | null
          casual_leave_limit: number | null
          compensatory_off_balance: number | null
          compensatory_off_limit: number | null
          created_at: string | null
          earned_leave_balance: number | null
          earned_leave_limit: number | null
          id: string
          maternity_leave_balance: number | null
          maternity_leave_limit: number | null
          optional_holidays_claimed: number | null
          paternity_leave_balance: number | null
          paternity_leave_limit: number | null
          sick_leave_balance: number | null
          sick_leave_limit: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          casual_leave_balance?: number | null
          casual_leave_limit?: number | null
          compensatory_off_balance?: number | null
          compensatory_off_limit?: number | null
          created_at?: string | null
          earned_leave_balance?: number | null
          earned_leave_limit?: number | null
          id?: string
          maternity_leave_balance?: number | null
          maternity_leave_limit?: number | null
          optional_holidays_claimed?: number | null
          paternity_leave_balance?: number | null
          paternity_leave_limit?: number | null
          sick_leave_balance?: number | null
          sick_leave_limit?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          casual_leave_balance?: number | null
          casual_leave_limit?: number | null
          compensatory_off_balance?: number | null
          compensatory_off_limit?: number | null
          created_at?: string | null
          earned_leave_balance?: number | null
          earned_leave_limit?: number | null
          id?: string
          maternity_leave_balance?: number | null
          maternity_leave_limit?: number | null
          optional_holidays_claimed?: number | null
          paternity_leave_balance?: number | null
          paternity_leave_limit?: number | null
          sick_leave_balance?: number | null
          sick_leave_limit?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      master: {
        Row: {
          activity_name: string | null
          address: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          assignment_status: string | null
          associated_member_linkedin: string | null
          city: string | null
          company_linkedin_url: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deppt: string | null
          designation: string | null
          emp_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          extra: string | null
          extra_1: string | null
          extra_2: string | null
          generic_email_id: string | null
          head_office_location: string | null
          id: string | null
          industry_type: string | null
          job_level_updated: string | null
          last_call_date: string | null
          latest_disposition: string | null
          latest_subdisposition: string | null
          linkedin: string | null
          location: string | null
          mobile_numb: string
          mobile2: string | null
          name: string
          next_call_date: string | null
          official: string | null
          personal_email_id: string | null
          pincode: string | null
          remarks: string | null
          salutation: string | null
          source: string | null
          source_1: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          turnover_link: string | null
          updated_at: string
          user_id: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          activity_name?: string | null
          address?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_status?: string | null
          associated_member_linkedin?: string | null
          city?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          extra?: string | null
          extra_1?: string | null
          extra_2?: string | null
          generic_email_id?: string | null
          head_office_location?: string | null
          id?: string | null
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb: string
          mobile2?: string | null
          name: string
          next_call_date?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          remarks?: string | null
          salutation?: string | null
          source?: string | null
          source_1?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          turnover_link?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          activity_name?: string | null
          address?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_status?: string | null
          associated_member_linkedin?: string | null
          city?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          extra?: string | null
          extra_1?: string | null
          extra_2?: string | null
          generic_email_id?: string | null
          head_office_location?: string | null
          id?: string | null
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string
          mobile2?: string | null
          name?: string
          next_call_date?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          remarks?: string | null
          salutation?: string | null
          source?: string | null
          source_1?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          turnover_link?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      monthly_point_summaries: {
        Row: {
          certificate_url: string | null
          created_at: string
          id: string
          is_winner: boolean | null
          month_year: string
          rank_in_team: number | null
          star_tier: string | null
          team_id: string | null
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          id?: string
          is_winner?: boolean | null
          month_year: string
          rank_in_team?: number | null
          star_tier?: string | null
          team_id?: string | null
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          id?: string
          is_winner?: boolean | null
          month_year?: string
          rank_in_team?: number | null
          star_tier?: string | null
          team_id?: string | null
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_point_summaries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_items: {
        Row: {
          created_at: string | null
          display_order: number
          icon_name: string
          id: string
          is_active: boolean
          item_key: string
          item_title: string
          item_url: string
          legacy_permission: string | null
          requires_auth_only: boolean
          section_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          icon_name: string
          id?: string
          is_active?: boolean
          item_key: string
          item_title: string
          item_url: string
          legacy_permission?: string | null
          requires_auth_only?: boolean
          section_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          item_key?: string
          item_title?: string
          item_url?: string
          legacy_permission?: string | null
          requires_auth_only?: boolean
          section_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "navigation_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "navigation_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_sections: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          section_key: string
          section_label: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          section_key: string
          section_label: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          section_key?: string
          section_label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          general_task_id: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          general_task_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          read_at?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          general_task_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_general_task_id_fkey"
            columns: ["general_task_id"]
            isOneToOne: false
            referencedRelation: "general_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_documents: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          submission_id: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          submission_id: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          submission_id?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "onboarding_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_otp_verifications: {
        Row: {
          contact: string
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          type: string
          verified: boolean
        }
        Insert: {
          contact: string
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          type: string
          verified?: boolean
        }
        Update: {
          contact?: string
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          type?: string
          verified?: boolean
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          action_label: string | null
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          step_order: number
          target_element: string | null
          target_route: string | null
          title: string
          tour_id: string
        }
        Insert: {
          action_label?: string | null
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          step_order: number
          target_element?: string | null
          target_route?: string | null
          title: string
          tour_id: string
        }
        Update: {
          action_label?: string | null
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          step_order?: number
          target_element?: string | null
          target_route?: string | null
          title?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_submissions: {
        Row: {
          aadhar_number: string | null
          account_number: string | null
          ai_review_at: string | null
          ai_review_result: Json | null
          bank_name: string | null
          blood_group: string | null
          branch_name: string | null
          contact_number: string
          created_at: string
          date_of_birth: string | null
          email_verified: boolean
          emergency_contact_number: string | null
          father_name: string | null
          form_id: string
          full_name: string
          gender: string | null
          id: string
          ifsc_code: string | null
          marital_status: string | null
          mother_name: string | null
          pan_number: string | null
          permanent_address: string | null
          personal_email: string
          phone_verified: boolean
          present_address: string | null
          qualifications: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uan_number: string | null
          updated_at: string
        }
        Insert: {
          aadhar_number?: string | null
          account_number?: string | null
          ai_review_at?: string | null
          ai_review_result?: Json | null
          bank_name?: string | null
          blood_group?: string | null
          branch_name?: string | null
          contact_number: string
          created_at?: string
          date_of_birth?: string | null
          email_verified?: boolean
          emergency_contact_number?: string | null
          father_name?: string | null
          form_id: string
          full_name: string
          gender?: string | null
          id?: string
          ifsc_code?: string | null
          marital_status?: string | null
          mother_name?: string | null
          pan_number?: string | null
          permanent_address?: string | null
          personal_email: string
          phone_verified?: boolean
          present_address?: string | null
          qualifications?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uan_number?: string | null
          updated_at?: string
        }
        Update: {
          aadhar_number?: string | null
          account_number?: string | null
          ai_review_at?: string | null
          ai_review_result?: Json | null
          bank_name?: string | null
          blood_group?: string | null
          branch_name?: string | null
          contact_number?: string
          created_at?: string
          date_of_birth?: string | null
          email_verified?: boolean
          emergency_contact_number?: string | null
          father_name?: string | null
          form_id?: string
          full_name?: string
          gender?: string | null
          id?: string
          ifsc_code?: string | null
          marital_status?: string | null
          mother_name?: string | null
          pan_number?: string | null
          permanent_address?: string | null
          personal_email?: string
          phone_verified?: boolean
          present_address?: string | null
          qualifications?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uan_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "onboarding_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tours: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          target_roles: string[] | null
          title: string
          tour_type: Database["public"]["Enums"]["tour_type"]
          updated_at: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          target_roles?: string[] | null
          title: string
          tour_type: Database["public"]["Enums"]["tour_type"]
          updated_at?: string | null
          version: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          target_roles?: string[] | null
          title?: string
          tour_type?: Database["public"]["Enums"]["tour_type"]
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      operations_inventory_distribution: {
        Row: {
          awb_number: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          damaged_lost_count: number | null
          despatch_date: string
          despatched_to: string
          dispatch_mode: string
          distribution_type: string
          id: string
          images: string[] | null
          inventory_item_id: string | null
          location: string | null
          net_quantity: number | null
          notes: string | null
          project_id: string | null
          quantity_dispatched: number
          return_location: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          awb_number?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          damaged_lost_count?: number | null
          despatch_date: string
          despatched_to: string
          dispatch_mode: string
          distribution_type: string
          id?: string
          images?: string[] | null
          inventory_item_id?: string | null
          location?: string | null
          net_quantity?: number | null
          notes?: string | null
          project_id?: string | null
          quantity_dispatched?: number
          return_location?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          awb_number?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          damaged_lost_count?: number | null
          despatch_date?: string
          despatched_to?: string
          dispatch_mode?: string
          distribution_type?: string
          id?: string
          images?: string[] | null
          inventory_item_id?: string | null
          location?: string | null
          net_quantity?: number | null
          notes?: string | null
          project_id?: string | null
          quantity_dispatched?: number
          return_location?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_inventory_distribution_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_inventory_distribution_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_inventory_distribution_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          external_org_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          external_org_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          external_org_id?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      password_reset_logs: {
        Row: {
          action_status: string
          admin_email: string
          admin_full_name: string | null
          admin_user_id: string
          created_at: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          target_email: string
          target_full_name: string | null
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          action_status: string
          admin_email: string
          admin_full_name?: string | null
          admin_user_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          target_email: string
          target_full_name?: string | null
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          action_status?: string
          admin_email?: string
          admin_full_name?: string | null
          admin_user_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          target_email?: string
          target_full_name?: string | null
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      payment_proof_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          parse_error: string | null
          parse_status: string | null
          parsed_data: Json | null
          payment_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          parse_error?: string | null
          parse_status?: string | null
          parsed_data?: Json | null
          payment_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          parse_error?: string | null
          parse_status?: string | null
          parsed_data?: Json | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proof_images_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "quotation_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          stage_order: number
          stage_type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          stage_order: number
          stage_type?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          stage_order?: number
          stage_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      point_activity_types: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          points_value: number
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          points_value: number
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          points_value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          exit_date: string | null
          exit_reason: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_tour_version_seen: number | null
          location: string | null
          onboarding_completed: boolean | null
          onboarding_skipped: boolean | null
          phone: string | null
          reports_to: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          exit_date?: string | null
          exit_reason?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_tour_version_seen?: number | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_skipped?: boolean | null
          phone?: string | null
          reports_to?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          exit_date?: string | null
          exit_reason?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_tour_version_seen?: number | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_skipped?: boolean | null
          phone?: string | null
          reports_to?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_demandcom_allocations: {
        Row: {
          created_at: string | null
          data_allocation: number | null
          id: string
          project_id: string
          registration_target: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_allocation?: number | null
          id?: string
          project_id: string
          registration_target?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_allocation?: number | null
          id?: string
          project_id?: string
          registration_target?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_demandcom_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_demandcom_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_demandcom_checklist: {
        Row: {
          assigned_to: string | null
          checklist_item: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist_item: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist_item?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_demandcom_checklist_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_demandcom_checklist_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_digicom_checklist: {
        Row: {
          assigned_to: string | null
          checklist_item: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist_item: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist_item?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_digicom_checklist_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_digicom_checklist_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          project_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          project_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          project_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_livecom_checklist: {
        Row: {
          assigned_to: string | null
          checklist_item: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist_item: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist_item?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_livecom_checklist_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_livecom_checklist_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_livecom_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          internal_cost_exc_tax: number | null
          project_id: string
          rating_by_csbd: number | null
          rating_by_livecom: number | null
          remarks_by_csbd: string | null
          remarks_by_livecom: string | null
          services: string | null
          updated_at: string | null
          vendor_hotel_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          internal_cost_exc_tax?: number | null
          project_id: string
          rating_by_csbd?: number | null
          rating_by_livecom?: number | null
          remarks_by_csbd?: string | null
          remarks_by_livecom?: string | null
          services?: string | null
          updated_at?: string | null
          vendor_hotel_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          internal_cost_exc_tax?: number | null
          project_id?: string
          rating_by_csbd?: number | null
          rating_by_livecom?: number | null
          remarks_by_csbd?: string | null
          remarks_by_livecom?: string | null
          services?: string | null
          updated_at?: string | null
          vendor_hotel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_livecom_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_livecom_events_vendor_hotel_id_fkey"
            columns: ["vendor_hotel_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      project_quotations: {
        Row: {
          amount: number | null
          client_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          invoice_date: string | null
          notes: string | null
          paid_amount: number | null
          project_id: string
          quotation_number: string
          sent_at: string | null
          sent_to_email: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          paid_amount?: number | null
          project_id: string
          quotation_number: string
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string
          quotation_number?: string
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          completion_file_name: string | null
          completion_file_path: string | null
          completion_files: Json | null
          completion_notes: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          parent_task_id: string | null
          priority: string | null
          project_id: string | null
          restart_reason: string | null
          restarted_at: string | null
          restarted_by: string | null
          status: string
          task_name: string
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          completion_file_name?: string | null
          completion_file_path?: string | null
          completion_files?: Json | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          restart_reason?: string | null
          restarted_at?: string | null
          restarted_by?: string | null
          status?: string
          task_name: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          completion_file_name?: string | null
          completion_file_path?: string | null
          completion_files?: Json | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          restart_reason?: string | null
          restarted_at?: string | null
          restarted_by?: string | null
          status?: string
          task_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_restarted_by_fkey"
            columns: ["restarted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          project_id: string
          role_in_project: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id: string
          role_in_project?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id?: string
          role_in_project?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_notifications: {
        Row: {
          id: string
          notification_type: string
          notified_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_type?: string
          notified_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          id?: string
          notification_type?: string
          notified_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          brief: string | null
          campaign_type: string | null
          client_id: string | null
          closed_reason: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          event_dates: Json | null
          expected_afactor: number | null
          final_afactor: number | null
          id: string
          invoiced_closed_at: string | null
          locations: Json | null
          lost_reason: string | null
          management_fees: number | null
          number_of_attendees: number | null
          project_name: string
          project_number: string | null
          project_owner: string
          project_source: string | null
          project_value: number | null
          referrer_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brief?: string | null
          campaign_type?: string | null
          client_id?: string | null
          closed_reason?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_dates?: Json | null
          expected_afactor?: number | null
          final_afactor?: number | null
          id?: string
          invoiced_closed_at?: string | null
          locations?: Json | null
          lost_reason?: string | null
          management_fees?: number | null
          number_of_attendees?: number | null
          project_name: string
          project_number?: string | null
          project_owner: string
          project_source?: string | null
          project_value?: number | null
          referrer_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brief?: string | null
          campaign_type?: string | null
          client_id?: string | null
          closed_reason?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_dates?: Json | null
          expected_afactor?: number | null
          final_afactor?: number | null
          id?: string
          invoiced_closed_at?: string | null
          locations?: Json | null
          lost_reason?: string | null
          management_fees?: number | null
          number_of_attendees?: number | null
          project_name?: string
          project_number?: string | null
          project_owner?: string
          project_source?: string | null
          project_value?: number | null
          referrer_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_project_owner_fkey"
            columns: ["project_owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotation_payments: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_mode: string
          quotation_id: string
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_mode: string
          quotation_id: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          quotation_id?: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_payments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "project_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_metadata: {
        Row: {
          can_be_assigned_by: Database["public"]["Enums"]["app_role"][]
          created_at: string
          description: string | null
          display_name: string
          hierarchy_level: number
          is_visible_in_ui: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_be_assigned_by?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          description?: string | null
          display_name: string
          hierarchy_level: number
          is_visible_in_ui?: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_be_assigned_by?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          description?: string | null
          display_name?: string
          hierarchy_level?: number
          is_visible_in_ui?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      salary_slips: {
        Row: {
          basic_salary: number | null
          bonus: number | null
          conveyance_allowance: number | null
          created_at: string | null
          epf: number | null
          esic: number | null
          generated_at: string | null
          generated_by: string | null
          health_insurance: number | null
          hra: number | null
          id: string
          incentive: number | null
          is_published: boolean | null
          loss_of_pay_days: number | null
          medical_allowance: number | null
          month: number
          net_pay: number | null
          net_pay_words: string | null
          other_allowance: number | null
          other_deductions: number | null
          paid_days: number | null
          professional_tax: number | null
          remarks: string | null
          salary_advance: number | null
          special_allowance: number | null
          tds: number | null
          total_deductions: number | null
          total_earnings: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          basic_salary?: number | null
          bonus?: number | null
          conveyance_allowance?: number | null
          created_at?: string | null
          epf?: number | null
          esic?: number | null
          generated_at?: string | null
          generated_by?: string | null
          health_insurance?: number | null
          hra?: number | null
          id?: string
          incentive?: number | null
          is_published?: boolean | null
          loss_of_pay_days?: number | null
          medical_allowance?: number | null
          month: number
          net_pay?: number | null
          net_pay_words?: string | null
          other_allowance?: number | null
          other_deductions?: number | null
          paid_days?: number | null
          professional_tax?: number | null
          remarks?: string | null
          salary_advance?: number | null
          special_allowance?: number | null
          tds?: number | null
          total_deductions?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          basic_salary?: number | null
          bonus?: number | null
          conveyance_allowance?: number | null
          created_at?: string | null
          epf?: number | null
          esic?: number | null
          generated_at?: string | null
          generated_by?: string | null
          health_insurance?: number | null
          hra?: number | null
          id?: string
          incentive?: number | null
          is_published?: boolean | null
          loss_of_pay_days?: number | null
          medical_allowance?: number | null
          month?: number
          net_pay?: number | null
          net_pay_words?: string | null
          other_allowance?: number | null
          other_deductions?: number | null
          paid_days?: number | null
          professional_tax?: number | null
          remarks?: string | null
          salary_advance?: number | null
          special_allowance?: number | null
          tds?: number | null
          total_deductions?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      sync_batches: {
        Row: {
          batch_number: number
          batch_size: number
          completed_at: string | null
          created_at: string | null
          error_details: Json | null
          id: string
          offset_start: number
          records_failed: number | null
          records_inserted: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string
          sync_log_id: string
        }
        Insert: {
          batch_number: number
          batch_size: number
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          id?: string
          offset_start: number
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_log_id: string
        }
        Update: {
          batch_number?: number
          batch_size?: number
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          id?: string
          offset_start?: number
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_batches_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          current_batch: number | null
          duration_seconds: number | null
          error_details: Json | null
          id: string
          items_failed: number | null
          items_fetched: number | null
          items_inserted: number | null
          items_updated: number | null
          status: string
          sync_id: string | null
          sync_type: string
          total_batches: number | null
        }
        Insert: {
          created_at?: string
          current_batch?: number | null
          duration_seconds?: number | null
          error_details?: Json | null
          id?: string
          items_failed?: number | null
          items_fetched?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          status: string
          sync_id?: string | null
          sync_type: string
          total_batches?: number | null
        }
        Update: {
          created_at?: string
          current_batch?: number | null
          duration_seconds?: number | null
          error_details?: Json | null
          id?: string
          items_failed?: number | null
          items_fetched?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          status?: string
          sync_id?: string | null
          sync_type?: string
          total_batches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "sync_status"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          processed_items: number | null
          started_at: string
          started_by: string | null
          status: string
          sync_type: string
          total_items: number | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          processed_items?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          sync_type: string
          total_items?: number | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          processed_items?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          sync_type?: string
          total_items?: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string
          role_in_team: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string
          role_in_team?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string
          role_in_team?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          team_lead_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          team_lead_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          team_lead_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_announcement_views: {
        Row: {
          announcement_id: string
          dismissed: boolean | null
          id: string
          points_awarded: boolean | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          announcement_id: string
          dismissed?: boolean | null
          id?: string
          points_awarded?: boolean | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          announcement_id?: string
          dismissed?: boolean | null
          id?: string
          points_awarded?: boolean | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "feature_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_activity: {
        Row: {
          activity_date: string
          created_at: string
          has_activity: boolean | null
          id: string
          user_id: string
        }
        Insert: {
          activity_date?: string
          created_at?: string
          has_activity?: boolean | null
          id?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          has_activity?: boolean | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_designations: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          designation_id: string
          id: string
          is_current: boolean | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          designation_id: string
          id?: string
          is_current?: boolean | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          designation_id?: string
          id?: string
          is_current?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_designations_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          microsoft_email: string | null
          provider: string
          refresh_token: string
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          microsoft_email?: string | null
          provider?: string
          refresh_token: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          microsoft_email?: string | null
          provider?: string
          refresh_token?: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step_id: string | null
          id: string
          status: Database["public"]["Enums"]["onboarding_status"] | null
          tour_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["onboarding_status"] | null
          tour_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["onboarding_status"] | null
          tour_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_progress_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_onboarding_progress_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      user_optional_holiday_claims: {
        Row: {
          claim_date: string | null
          claim_type: string
          claimed_at: string | null
          holiday_id: string | null
          id: string
          user_id: string
          year: number
        }
        Insert: {
          claim_date?: string | null
          claim_type: string
          claimed_at?: string | null
          holiday_id?: string | null
          id?: string
          user_id: string
          year: number
        }
        Update: {
          claim_date?: string | null
          claim_type?: string
          claimed_at?: string | null
          holiday_id?: string | null
          id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_optional_holiday_claims_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "company_holidays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_optional_holiday_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          earned_at: string
          id: string
          month_year: string
          points: number
          reference_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          earned_at?: string
          id?: string
          month_year?: string
          points: number
          reference_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          earned_at?: string
          id?: string
          month_year?: string
          points?: number
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_points_activity_type_fkey"
            columns: ["activity_type"]
            isOneToOne: false
            referencedRelation: "point_activity_types"
            referencedColumns: ["activity_type"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_view_permissions: {
        Row: {
          can_view: boolean
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          navigation_item_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_view?: boolean
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          navigation_item_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_view?: boolean
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          navigation_item_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_view_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_view_permissions_navigation_item_id_fkey"
            columns: ["navigation_item_id"]
            isOneToOne: false
            referencedRelation: "navigation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_view_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vapi_call_logs: {
        Row: {
          assistant_id: string | null
          call_summary: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          demandcom_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          key_topics: string[] | null
          phone_number: string | null
          response_summary: string | null
          scheduled_call_id: string | null
          sentiment: string | null
          sentiment_score: number | null
          started_at: string | null
          status: string
          transcript: string | null
          vapi_call_id: string | null
        }
        Insert: {
          assistant_id?: string | null
          call_summary?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          demandcom_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          key_topics?: string[] | null
          phone_number?: string | null
          response_summary?: string | null
          scheduled_call_id?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          started_at?: string | null
          status?: string
          transcript?: string | null
          vapi_call_id?: string | null
        }
        Update: {
          assistant_id?: string | null
          call_summary?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          demandcom_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          key_topics?: string[] | null
          phone_number?: string | null
          response_summary?: string | null
          scheduled_call_id?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          started_at?: string | null
          status?: string
          transcript?: string | null
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vapi_call_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vapi_call_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vapi_call_logs_scheduled_call_id_fkey"
            columns: ["scheduled_call_id"]
            isOneToOne: false
            referencedRelation: "vapi_scheduled_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      vapi_scheduled_calls: {
        Row: {
          activity_name: string | null
          completed_count: number
          created_at: string
          created_by: string | null
          demandcom_ids: string[]
          failed_count: number
          first_message: string | null
          id: string
          notes: string | null
          scheduled_at: string
          status: string
          total_contacts: number
        }
        Insert: {
          activity_name?: string | null
          completed_count?: number
          created_at?: string
          created_by?: string | null
          demandcom_ids: string[]
          failed_count?: number
          first_message?: string | null
          id?: string
          notes?: string | null
          scheduled_at: string
          status?: string
          total_contacts?: number
        }
        Update: {
          activity_name?: string | null
          completed_count?: number
          created_at?: string
          created_by?: string | null
          demandcom_ids?: string[]
          failed_count?: number
          first_message?: string | null
          id?: string
          notes?: string | null
          scheduled_at?: string
          status?: string
          total_contacts?: number
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          contact_no: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          email_id: string | null
          gst: string | null
          id: string
          pin_code: string | null
          service_type: string | null
          state: string | null
          updated_at: string | null
          vendor_name: string
          vendor_type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_no?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          email_id?: string | null
          gst?: string | null
          id?: string
          pin_code?: string | null
          service_type?: string | null
          state?: string | null
          updated_at?: string | null
          vendor_name: string
          vendor_type: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_no?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          email_id?: string | null
          gst?: string | null
          id?: string
          pin_code?: string | null
          service_type?: string | null
          state?: string | null
          updated_at?: string | null
          vendor_name?: string
          vendor_type?: string
        }
        Relationships: []
      }
      webhook_connectors: {
        Row: {
          connector_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          rate_limit_per_minute: number
          target_table: string
          updated_at: string
          webhook_config: Json | null
          webhook_token: string
        }
        Insert: {
          connector_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate_limit_per_minute?: number
          target_table?: string
          updated_at?: string
          webhook_config?: Json | null
          webhook_token: string
        }
        Update: {
          connector_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate_limit_per_minute?: number
          target_table?: string
          updated_at?: string
          webhook_config?: Json | null
          webhook_token?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          demandcom_id: string | null
          error_message: string | null
          http_status_code: number
          id: string
          ip_address: string | null
          job_id: string | null
          request_id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          webhook_connector_id: string | null
        }
        Insert: {
          created_at?: string
          demandcom_id?: string | null
          error_message?: string | null
          http_status_code: number
          id?: string
          ip_address?: string | null
          job_id?: string | null
          request_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          webhook_connector_id?: string | null
        }
        Update: {
          created_at?: string
          demandcom_id?: string | null
          error_message?: string | null
          http_status_code?: number
          id?: string
          ip_address?: string | null
          job_id?: string | null
          request_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          webhook_connector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_connector_id_fkey"
            columns: ["webhook_connector_id"]
            isOneToOne: false
            referencedRelation: "webhook_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          demandcom_id: string | null
          direction: string
          error_message: string | null
          exotel_message_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_content: string | null
          phone_number: string
          read_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          template_id: string | null
          template_name: string | null
          template_variables: Json | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          demandcom_id?: string | null
          direction: string
          error_message?: string | null
          exotel_message_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string | null
          phone_number: string
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          template_variables?: Json | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          demandcom_id?: string | null
          direction?: string
          error_message?: string | null
          exotel_message_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string | null
          phone_number?: string
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          template_variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "demandcom_latest_per_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          created_at: string | null
          exotel_api_key: string | null
          exotel_api_token: string | null
          exotel_sid: string | null
          exotel_subdomain: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          waba_id: string | null
          whatsapp_source_number: string
        }
        Insert: {
          created_at?: string | null
          exotel_api_key?: string | null
          exotel_api_token?: string | null
          exotel_sid?: string | null
          exotel_subdomain?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          waba_id?: string | null
          whatsapp_source_number: string
        }
        Update: {
          created_at?: string | null
          exotel_api_key?: string | null
          exotel_api_token?: string | null
          exotel_sid?: string | null
          exotel_subdomain?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          waba_id?: string | null
          whatsapp_source_number?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          buttons: Json | null
          category: string | null
          content: string
          created_at: string | null
          footer_text: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language: string | null
          last_synced_at: string | null
          rejection_reason: string | null
          sample_values: Json | null
          status: string | null
          template_id: string
          template_name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          buttons?: Json | null
          category?: string | null
          content: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          template_id: string
          template_name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          buttons?: Json | null
          category?: string | null
          content?: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          template_id?: string
          template_name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      cashflow_summary: {
        Row: {
          overdue_amount: number | null
          pending_amount: number | null
          total_invoiced: number | null
          total_invoices: number | null
          total_received: number | null
        }
        Relationships: []
      }
      client_pending_summary: {
        Row: {
          client_id: string | null
          company_name: string | null
          contact_name: string | null
          invoice_count: number | null
          oldest_invoice_date: string | null
          pending_amount: number | null
        }
        Relationships: []
      }
      csbd_actuals: {
        Row: {
          actual_amount_inr_lacs: number | null
          deals_closed: number | null
          month: string | null
          project_numbers: string[] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_project_owner_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom_latest_per_mobile: {
        Row: {
          activity_name: string | null
          address: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          assignment_status: string | null
          associated_member_linkedin: string | null
          city: string | null
          company_linkedin_url: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          deppt: string | null
          designation: string | null
          emp_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          extra: string | null
          extra_1: string | null
          extra_2: string | null
          generic_email_id: string | null
          id: string | null
          industry_type: string | null
          job_level_updated: string | null
          last_call_date: string | null
          latest_disposition: string | null
          latest_subdisposition: string | null
          linkedin: string | null
          location: string | null
          mobile_numb: string | null
          mobile2: string | null
          name: string | null
          next_call_date: string | null
          official: string | null
          personal_email_id: string | null
          pincode: string | null
          remarks: string | null
          salutation: string | null
          source: string | null
          source_1: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          turnover_link: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          website: string | null
          zone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandcom_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_summary_stats: {
        Row: {
          allocated_count: number | null
          available_count: number | null
          damaged_count: number | null
          retired_count: number | null
          total_inventory: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_points: {
        Args: {
          p_activity_type: string
          p_description?: string
          p_reference_id?: string
          p_user_id: string
        }
        Returns: number
      }
      bulk_delete_clients: {
        Args: { p_record_ids: string[] }
        Returns: {
          deleted_count: number
        }[]
      }
      bulk_delete_clients_batch: {
        Args: {
          p_batch_size?: number
          p_offset?: number
          p_record_ids: string[]
        }
        Returns: {
          deleted_count: number
          has_more: boolean
          next_offset: number
        }[]
      }
      bulk_delete_demandcom: {
        Args: { p_record_ids: string[] }
        Returns: {
          deleted_count: number
        }[]
      }
      bulk_delete_demandcom_batch: {
        Args: {
          p_batch_size?: number
          p_offset?: number
          p_record_ids: string[]
        }
        Returns: {
          deleted_count: number
          has_more: boolean
          next_offset: number
        }[]
      }
      calculate_comp_off_days: {
        Args: { p_user_id: string; p_year: number }
        Returns: number
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_sandwich_leave_days: {
        Args: { p_end_date: string; p_start_date: string; p_user_id?: string }
        Returns: Json
      }
      calculate_star_tier: { Args: { p_points: number }; Returns: string }
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_user: {
        Args: { _accessor_id: string; _target_id: string }
        Returns: boolean
      }
      can_view_navigation_item: {
        Args: { _item_key: string; _user_id: string }
        Returns: boolean
      }
      check_webhook_rate_limit: {
        Args: { _limit: number; _webhook_id: string }
        Returns: boolean
      }
      clean_all_demandcom: {
        Args: never
        Returns: {
          deleted_count: number
        }[]
      }
      clean_all_demandcom_batch: {
        Args: { p_batch_size?: number }
        Returns: {
          deleted_count: number
          has_more: boolean
        }[]
      }
      cleanup_import_staging: { Args: never; Returns: number }
      delete_demandcom_by_activity: {
        Args: { p_activity_name: string }
        Returns: {
          deleted_count: number
        }[]
      }
      delete_demandcom_by_activity_batch: {
        Args: { p_activity_name: string; p_batch_size?: number }
        Returns: {
          deleted_count: number
          has_more: boolean
        }[]
      }
      delete_user_related_data: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      execute_read_query: { Args: { query_text: string }; Returns: Json }
      format_master_csv_row: {
        Args: { p_row: Database["public"]["Tables"]["master"]["Row"] }
        Returns: string
      }
      generate_master_export_batch: {
        Args: {
          p_batch_size?: number
          p_include_header?: boolean
          p_offset?: number
        }
        Returns: {
          csv_content: string
          records_count: number
        }[]
      }
      generate_project_number: { Args: never; Returns: string }
      get_activity_names_with_counts: {
        Args: never
        Returns: {
          activity_name: string
          count: number
        }[]
      }
      get_activity_registrations: {
        Args: { p_activity_name?: string }
        Returns: {
          activity_name: string
          registered: number
          registration_rate: number
          today_registered: number
          total_leads: number
        }[]
      }
      get_agent_performance: {
        Args: { p_agent_name?: string; p_date?: string }
        Returns: {
          agent_id: string
          agent_name: string
          connect_rate: number
          connects: number
          conversion_rate: number
          interested: number
          registered: number
          team_avg_calls: number
          total_calls: number
          vs_team_avg_pct: number
          vs_yesterday_pct: number
          yesterday_calls: number
        }[]
      }
      get_all_activity_names: {
        Args: never
        Returns: {
          activity_name: string
        }[]
      }
      get_all_demandcom_activities: {
        Args: never
        Returns: {
          activity_name: string
        }[]
      }
      get_all_subordinate_ids: {
        Args: { manager_id: string }
        Returns: string[]
      }
      get_collection_efficiency: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          efficiency_pct: number
          period_invoiced: number
          period_received: number
          prev_efficiency_pct: number
          prev_period_invoiced: number
          prev_period_received: number
          trend: string
          trend_pct: number
        }[]
      }
      get_daily_record_counts: {
        Args: { days: number }
        Returns: {
          created_count: number
          date: string
          updated_count: number
        }[]
      }
      get_demandcom_activity_stats: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          activity_name: string
          interested: number
          latest_created_at: string
          registered: number
          total: number
        }[]
      }
      get_demandcom_agent_stats: {
        Args: { p_team_name?: string }
        Returns: {
          agent_id: string
          agent_name: string
          tagged_count: number
          total_assigned: number
        }[]
      }
      get_demandcom_disposition_breakdown: {
        Args: {
          p_activity_filter?: string
          p_agent_filter?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          count: number
          disposition: string
        }[]
      }
      get_demandcom_kpi_metrics: {
        Args: {
          p_activity_filter?: string
          p_agent_filter?: string
          p_end_date?: string
          p_start_date?: string
          p_today_start?: string
        }
        Returns: {
          assigned_count: number
          registered_count: number
          total_count: number
          updated_today_count: number
        }[]
      }
      get_execution_project_stats: {
        Args: never
        Returns: {
          assigned_data: number
          interested_count: number
          project_name: string
          registered_count: number
          required_participants: number
        }[]
      }
      get_master_chart_aggregates: {
        Args: {
          p_activity_names?: string[]
          p_cities?: string[]
          p_departments?: string[]
          p_emp_sizes?: string[]
          p_industry_types?: string[]
          p_job_levels?: string[]
          p_states?: string[]
          p_sub_industries?: string[]
          p_turnovers?: string[]
        }
        Returns: Json
      }
      get_master_filter_options: { Args: never; Returns: Json }
      get_project_creator_name: { Args: { _user_id: string }; Returns: string }
      get_project_payment_summary: {
        Args: { p_project_name?: string }
        Returns: {
          client_name: string
          collection_rate: number
          payment_count: number
          project_id: string
          project_name: string
          project_number: string
          quotation_count: number
          total_invoiced: number
          total_pending: number
          total_received: number
        }[]
      }
      get_top_pending_companies: {
        Args: { p_limit?: number }
        Returns: {
          client_id: string
          company_name: string
          contact_name: string
          invoice_count: number
          oldest_pending_days: number
          total_pending: number
        }[]
      }
      get_user_conversation_ids: {
        Args: { checking_user_id: string }
        Returns: string[]
      }
      get_user_designation_level: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_subordinate_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_voice_bi_overview: {
        Args: never
        Returns: {
          active_projects: number
          agents_active: number
          collection_rate: number
          today_calls: number
          today_registrations: number
          total_invoiced: number
          total_pending: number
          total_projects: number
          total_received: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_hr_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_participant_in_conversation: {
        Args: { checking_user_id: string; conv_id: string }
        Returns: boolean
      }
      is_project_team_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      process_bulk_import_batch: {
        Args: {
          p_batch_size?: number
          p_import_id: string
          p_table_name: string
          p_user_id: string
        }
        Returns: Json
      }
      process_export_batch: {
        Args: { p_batch_num: number; p_batch_size?: number; p_job_id: string }
        Returns: Json
      }
      process_master_import_batch: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      process_sync_batch: { Args: { p_batch_id: string }; Returns: Json }
      recalculate_all_comp_off: {
        Args: { p_year: number }
        Returns: {
          comp_off_days: number
          new_balance: number
          used_days: number
          user_id: string
        }[]
      }
      record_daily_activity: { Args: { p_user_id: string }; Returns: undefined }
      revert_bulk_import: {
        Args: { p_import_id: string; p_user_id: string }
        Returns: Json
      }
      sync_demandcom_to_master: {
        Args: never
        Returns: {
          failed_records: Json
          total_failed: number
          total_inserted: number
          total_processed: number
          total_updated: number
        }[]
      }
      update_import_progress: {
        Args: { p_import_id: string }
        Returns: undefined
      }
      update_monthly_summary: {
        Args: { p_month_year?: string; p_user_id: string }
        Returns: undefined
      }
      update_sync_log_progress: {
        Args: { p_sync_log_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "user"
        | "client"
        | "platform_admin"
        | "admin_administration"
        | "admin_tech"
        | "agent"
        | "csbd"
        | "leadership"
        | "hr_manager"
      import_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "sick_leave"
        | "casual_leave"
        | "earned_leave"
        | "unpaid_leave"
        | "compensatory_off"
        | "maternity_leave"
        | "paternity_leave"
      onboarding_status: "not_started" | "in_progress" | "completed" | "skipped"
      priority_level: "high" | "medium" | "low"
      recommendation_status: "pending" | "completed" | "dismissed"
      recommendation_type:
        | "contact"
        | "campaign"
        | "follow_up"
        | "placement"
        | "re_engage"
        | "update_profile"
      regularization_status: "pending" | "approved" | "rejected"
      regularization_type:
        | "forgot_signin"
        | "forgot_signout"
        | "time_correction"
        | "location_issue"
        | "other"
      tour_type: "initial" | "feature_update"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
        "super_admin",
        "admin",
        "manager",
        "user",
        "client",
        "platform_admin",
        "admin_administration",
        "admin_tech",
        "agent",
        "csbd",
        "leadership",
        "hr_manager",
      ],
      import_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "sick_leave",
        "casual_leave",
        "earned_leave",
        "unpaid_leave",
        "compensatory_off",
        "maternity_leave",
        "paternity_leave",
      ],
      onboarding_status: ["not_started", "in_progress", "completed", "skipped"],
      priority_level: ["high", "medium", "low"],
      recommendation_status: ["pending", "completed", "dismissed"],
      recommendation_type: [
        "contact",
        "campaign",
        "follow_up",
        "placement",
        "re_engage",
        "update_profile",
      ],
      regularization_status: ["pending", "approved", "rejected"],
      regularization_type: [
        "forgot_signin",
        "forgot_signout",
        "time_correction",
        "location_issue",
        "other",
      ],
      tour_type: ["initial", "feature_update"],
    },
  },
} as const
