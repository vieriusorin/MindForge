export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      attempts: {
        Row: {
          answered_at: string;
          chosen: string[];
          content_hash: string | null;
          correct: boolean;
          id: number;
          pack_slug: string;
          question_id: string;
          skill_code: string;
          storm_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answered_at?: string;
          chosen: string[];
          content_hash?: string | null;
          correct: boolean;
          id?: never;
          pack_slug: string;
          question_id: string;
          skill_code: string;
          storm_id?: string | null;
          user_id?: string;
        };
        Update: {
          answered_at?: string;
          chosen?: string[];
          content_hash?: string | null;
          correct?: boolean;
          id?: never;
          pack_slug?: string;
          question_id?: string;
          skill_code?: string;
          storm_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_storm_id_fkey";
            columns: ["storm_id"];
            isOneToOne: false;
            referencedRelation: "storms";
            referencedColumns: ["id"];
          },
        ];
      };
      course_completions: {
        Row: {
          completed_at: string;
          pack_slug: string;
          pack_version: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string;
          pack_slug: string;
          pack_version: number;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          pack_slug?: string;
          pack_version?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      expeditions: {
        Row: {
          created_by: string;
          domain_code: string;
          ends_at: string | null;
          group_id: string;
          id: string;
          pack_slug: string;
          starts_at: string;
          target: number;
        };
        ComputedFields: never;
        Insert: {
          created_by: string;
          domain_code: string;
          ends_at?: string | null;
          group_id: string;
          id?: string;
          pack_slug: string;
          starts_at: string;
          target: number;
        };
        Update: {
          created_by?: string;
          domain_code?: string;
          ends_at?: string | null;
          group_id?: string;
          id?: string;
          pack_slug?: string;
          starts_at?: string;
          target?: number;
        };
        Relationships: [
          {
            foreignKeyName: "expeditions_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          joined_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          created_by: string;
          discussion_url: string | null;
          id: string;
          invite_code: string;
          name: string;
          pack_slug: string;
          path_slug: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          discussion_url?: string | null;
          id?: string;
          invite_code: string;
          name: string;
          pack_slug: string;
          path_slug?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          discussion_url?: string | null;
          id?: string;
          invite_code?: string;
          name?: string;
          pack_slug?: string;
          path_slug?: string | null;
        };
        Relationships: [];
      };
      path_enrollments: {
        Row: {
          path_slug: string;
          started_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          path_slug: string;
          started_at?: string;
          user_id?: string;
        };
        Update: {
          path_slug?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      storm_questions: {
        Row: {
          chosen: string[] | null;
          chosen_at: string | null;
          content_hash: string;
          correct: boolean | null;
          domain_code: string;
          position: number;
          question_id: string;
          skill_code: string;
          storm_id: string;
          unreviewed: boolean;
          user_id: string;
          voided: boolean;
        };
        ComputedFields: never;
        Insert: {
          chosen?: string[] | null;
          chosen_at?: string | null;
          content_hash: string;
          correct?: boolean | null;
          domain_code: string;
          position: number;
          question_id: string;
          skill_code: string;
          storm_id: string;
          unreviewed: boolean;
          user_id: string;
          voided?: boolean;
        };
        Update: {
          chosen?: string[] | null;
          chosen_at?: string | null;
          content_hash?: string;
          correct?: boolean | null;
          domain_code?: string;
          position?: number;
          question_id?: string;
          skill_code?: string;
          storm_id?: string;
          unreviewed?: boolean;
          user_id?: string;
          voided?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "storm_questions_storm_id_fkey";
            columns: ["storm_id"];
            isOneToOne: false;
            referencedRelation: "storms";
            referencedColumns: ["id"];
          },
        ];
      };
      storms: {
        Row: {
          domain_code: string | null;
          ends_at: string;
          finished_at: string | null;
          id: string;
          kind: string;
          pack_slug: string;
          started_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          domain_code?: string | null;
          ends_at: string;
          finished_at?: string | null;
          id?: string;
          kind: string;
          pack_slug: string;
          started_at: string;
          user_id: string;
        };
        Update: {
          domain_code?: string | null;
          ends_at?: string;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          pack_slug?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      advance_group_course: {
        Args: { p_from_pack?: string; p_group_id: string };
        Returns: string;
      };
      answer_storm_question: {
        Args: {
          p_chosen: string[];
          p_content_hash: string;
          p_question_id: string;
          p_storm_id: string;
        };
        Returns: undefined;
      };
      approve_analogy: {
        Args: { p_content_hash?: string; p_item_id: string };
        Returns: undefined;
      };
      create_group: {
        Args: { p_name: string; p_pack_slug: string };
        Returns: string;
      };
      create_path_group: {
        Args: { p_name: string; p_path_slug: string };
        Returns: string;
      };
      end_expedition: { Args: { p_group_id: string }; Returns: undefined };
      expedition_pack: { Args: { p_expedition_id: string }; Returns: string };
      expedition_progress: {
        Args: { p_expedition_id: string };
        Returns: number;
      };
      finalize_expired_storms: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      finish_storm: { Args: { p_storm_id: string }; Returns: undefined };
      group_attempts: {
        Args: { p_group_id: string; p_viewer_id: string };
        Returns: {
          attempts: Json;
          is_viewer: boolean;
          member_key: number;
        }[];
      };
      group_invite_preview: {
        Args: { p_code: string };
        Returns: {
          name: string;
          path_slug: string;
        }[];
      };
      join_group: { Args: { p_code: string }; Returns: string };
      latest_expedition: {
        Args: { p_group_id: string };
        Returns: {
          domain_code: string;
          ends_at: string;
          id: string;
          starts_at: string;
          target: number;
        }[];
      };
      list_my_pins: {
        Args: Record<PropertyKey, never>;
        Returns: {
          group_id: string;
          pinned_at: string;
        }[];
      };
      list_open_flags: {
        Args: { p_pack_slug: string };
        Returns: {
          comment: string;
          created_at: string;
          flag_id: number;
          item_id: string;
          reviewer_name: string;
        }[];
      };
      list_pending_analogies: {
        Args: { p_pack_slug: string };
        Returns: {
          approvals: number;
          can_approve: boolean;
          hash_synced_at: string;
          item_id: string;
        }[];
      };
      list_reviewable: {
        Args: { p_pack_slug: string };
        Returns: {
          content_hash: string;
          item_id: string;
          item_type: string;
          skill_code: string;
        }[];
      };
      pin_group: {
        Args: { p_group_id: string };
        Returns: {
          evicted_id: string;
          evicted_name: string;
        }[];
      };
      record_attempt: {
        Args: {
          p_chosen: string[];
          p_content_hash?: string;
          p_question_id: string;
        };
        Returns: boolean;
      };
      resolve_flags: {
        Args: {
          p_action: string;
          p_comment: string;
          p_content_hash?: string;
          p_item_id: string;
        };
        Returns: undefined;
      };
      review_item: {
        Args: {
          p_comment: string;
          p_content_hash?: string;
          p_item_id: string;
          p_verdict: string;
        };
        Returns: undefined;
      };
      review_states: {
        Args: { p_pack_slug: string };
        Returns: {
          item_id: string;
          reviewed_at: string;
          state: string;
        }[];
      };
      rotate_invite_code: { Args: { p_group_id: string }; Returns: string };
      set_group_discussion_url: {
        Args: { p_group_id: string; p_url: string };
        Returns: undefined;
      };
      start_expedition: {
        Args: { p_domain_code: string; p_group_id: string; p_target: number };
        Returns: string;
      };
      start_storm: {
        Args: {
          p_domain_code?: string;
          p_kind: string;
          p_pack_slug: string;
          p_questions?: Json;
        };
        Returns: string;
      };
      unpin_group: { Args: { p_group_id: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
