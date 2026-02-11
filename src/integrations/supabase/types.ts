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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      brand_examples: {
        Row: {
          brand_id: string
          content_type: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string
          subtype: string | null
          thumb_url: string | null
          type: string
        }
        Insert: {
          brand_id: string
          content_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          subtype?: string | null
          thumb_url?: string | null
          type?: string
        }
        Update: {
          brand_id?: string
          content_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          subtype?: string | null
          thumb_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_examples_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_template_sets: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          source_example_ids: Json | null
          status: string
          template_set: Json
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          source_example_ids?: Json | null
          status?: string
          template_set?: Json
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          source_example_ids?: Json | null
          status?: string
          template_set?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_template_sets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          default_template_set_id: string | null
          do_rules: string | null
          dont_rules: string | null
          fonts: Json | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          palette: Json | null
          style_guide: Json | null
          style_guide_updated_at: string | null
          style_guide_version: number
          updated_at: string
          visual_tone: string | null
        }
        Insert: {
          created_at?: string
          default_template_set_id?: string | null
          do_rules?: string | null
          dont_rules?: string | null
          fonts?: Json | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          palette?: Json | null
          style_guide?: Json | null
          style_guide_updated_at?: string | null
          style_guide_version?: number
          updated_at?: string
          visual_tone?: string | null
        }
        Update: {
          created_at?: string
          default_template_set_id?: string | null
          do_rules?: string | null
          dont_rules?: string | null
          fonts?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          palette?: Json | null
          style_guide?: Json | null
          style_guide_updated_at?: string | null
          style_guide_version?: number
          updated_at?: string
          visual_tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_default_template_set_id_fkey"
            columns: ["default_template_set_id"]
            isOneToOne: false
            referencedRelation: "brand_template_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_contents: {
        Row: {
          brand_id: string | null
          brand_snapshot: Json | null
          caption: string | null
          content_type: string
          created_at: string
          hashtags: string[] | null
          id: string
          image_urls: string[] | null
          key_insights: string[] | null
          scheduled_at: string | null
          slides: Json | null
          source_summary: string | null
          status: string | null
          title: string
          trend_id: string | null
          updated_at: string
          user_id: string
          visual_mode: string
        }
        Insert: {
          brand_id?: string | null
          brand_snapshot?: Json | null
          caption?: string | null
          content_type: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_urls?: string[] | null
          key_insights?: string[] | null
          scheduled_at?: string | null
          slides?: Json | null
          source_summary?: string | null
          status?: string | null
          title: string
          trend_id?: string | null
          updated_at?: string
          user_id: string
          visual_mode?: string
        }
        Update: {
          brand_id?: string | null
          brand_snapshot?: Json | null
          caption?: string | null
          content_type?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_urls?: string[] | null
          key_insights?: string[] | null
          scheduled_at?: string | null
          slides?: Json | null
          source_summary?: string | null
          status?: string | null
          title?: string
          trend_id?: string | null
          updated_at?: string
          user_id?: string
          visual_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_contents_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contents_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generations: {
        Row: {
          created_at: string
          height: number | null
          id: string
          image_url: string | null
          is_selected: boolean | null
          model_used: string | null
          prompt_id: string | null
          ranking_reason: string | null
          ranking_score: number | null
          seed: string | null
          slide_id: string
          thumb_url: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          image_url?: string | null
          is_selected?: boolean | null
          model_used?: string | null
          prompt_id?: string | null
          ranking_reason?: string | null
          ranking_score?: number | null
          seed?: string | null
          slide_id: string
          thumb_url?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          image_url?: string | null
          is_selected?: boolean | null
          model_used?: string | null
          prompt_id?: string | null
          ranking_reason?: string | null
          ranking_score?: number | null
          seed?: string | null
          slide_id?: string
          thumb_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_generations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "image_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_generations_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      image_prompts: {
        Row: {
          brief_id: string | null
          created_at: string
          id: string
          model_hint: string | null
          negative_prompt: string | null
          prompt: string
          slide_id: string
          variant_index: number | null
        }
        Insert: {
          brief_id?: string | null
          created_at?: string
          id?: string
          model_hint?: string | null
          negative_prompt?: string | null
          prompt: string
          slide_id: string
          variant_index?: number | null
        }
        Update: {
          brief_id?: string | null
          created_at?: string
          id?: string
          model_hint?: string | null
          negative_prompt?: string | null
          prompt?: string
          slide_id?: string
          variant_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_prompts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "visual_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_prompts_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content_type: string
          created_at: string
          id: string
          project_id: string
          raw_post_text: string
          status: string | null
          updated_at: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          id?: string
          project_id: string
          raw_post_text: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          project_id?: string
          raw_post_text?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          instagram_handle: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_feedback: {
        Row: {
          created_at: string
          id: string
          image_generation_id: string
          notes: string | null
          reasons: Json | null
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_generation_id: string
          notes?: string | null
          reasons?: Json | null
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          image_generation_id?: string
          notes?: string | null
          reasons?: Json | null
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_feedback_image_generation_id_fkey"
            columns: ["image_generation_id"]
            isOneToOne: false
            referencedRelation: "image_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_metrics: {
        Row: {
          adherence: number | null
          brand_consistency: number | null
          created_at: string
          id: string
          legibility: number | null
          premium_look: number | null
          publish_ready: boolean | null
          slide_id: string
        }
        Insert: {
          adherence?: number | null
          brand_consistency?: number | null
          created_at?: string
          id?: string
          legibility?: number | null
          premium_look?: number | null
          publish_ready?: boolean | null
          slide_id: string
        }
        Update: {
          adherence?: number | null
          brand_consistency?: number | null
          created_at?: string
          id?: string
          legibility?: number | null
          premium_look?: number | null
          publish_ready?: boolean | null
          slide_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_metrics_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_trends: {
        Row: {
          id: string
          saved_at: string
          trend_id: string
          user_id: string
        }
        Insert: {
          id?: string
          saved_at?: string
          trend_id: string
          user_id: string
        }
        Update: {
          id?: string
          saved_at?: string
          trend_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_trends_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
      slide_versions: {
        Row: {
          created_at: string
          id: string
          layout_preset: string | null
          selected_image_generation_id: string | null
          slide_id: string
          slide_text: string | null
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          layout_preset?: string | null
          selected_image_generation_id?: string | null
          slide_id: string
          slide_text?: string | null
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          layout_preset?: string | null
          selected_image_generation_id?: string | null
          slide_id?: string
          slide_text?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "slide_versions_selected_image_generation_id_fkey"
            columns: ["selected_image_generation_id"]
            isOneToOne: false
            referencedRelation: "image_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_versions_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          created_at: string
          id: string
          layout_preset: string | null
          post_id: string
          slide_index: number
          slide_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout_preset?: string | null
          post_id: string
          slide_index: number
          slide_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          layout_preset?: string | null
          post_id?: string
          slide_index?: number
          slide_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          full_content: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          relevance_score: number | null
          scraped_at: string | null
          source: string
          source_url: string | null
          theme: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          full_content?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          relevance_score?: number | null
          scraped_at?: string | null
          source: string
          source_url?: string | null
          theme: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          full_content?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          relevance_score?: number | null
          scraped_at?: string | null
          source?: string
          source_url?: string | null
          theme?: string
          title?: string
        }
        Relationships: []
      }
      visual_briefs: {
        Row: {
          composition_notes: string | null
          created_at: string
          emotion: string | null
          id: string
          key_message: string | null
          negative_elements: string | null
          palette: Json | null
          slide_id: string
          style: string | null
          text_limit_words: number | null
          text_on_image: boolean | null
          theme: string | null
          updated_at: string
          visual_metaphor: string | null
        }
        Insert: {
          composition_notes?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          key_message?: string | null
          negative_elements?: string | null
          palette?: Json | null
          slide_id: string
          style?: string | null
          text_limit_words?: number | null
          text_on_image?: boolean | null
          theme?: string | null
          updated_at?: string
          visual_metaphor?: string | null
        }
        Update: {
          composition_notes?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          key_message?: string | null
          negative_elements?: string | null
          palette?: Json | null
          slide_id?: string
          style?: string | null
          text_limit_words?: number | null
          text_on_image?: boolean | null
          theme?: string | null
          updated_at?: string
          visual_metaphor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_briefs_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: true
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
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
    Enums: {},
  },
} as const
