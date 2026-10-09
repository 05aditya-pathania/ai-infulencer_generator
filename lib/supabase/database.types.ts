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
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          credits: number;
          created_at: string;
          zernio_profile_id: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          credits?: number;
          created_at?: string;
          zernio_profile_id?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          credits?: number;
          created_at?: string;
          zernio_profile_id?: string | null;
        };
        Relationships: [];
      };
      social_accounts: {
        Row: {
          id: string;
          user_id: string;
          zernio_account_id: string;
          platform: string;
          username: string | null;
          display_name: string | null;
          profile_url: string | null;
          connected_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          zernio_account_id: string;
          platform: string;
          username?: string | null;
          display_name?: string | null;
          profile_url?: string | null;
          connected_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          zernio_account_id?: string;
          platform?: string;
          username?: string | null;
          display_name?: string | null;
          profile_url?: string | null;
          connected_at?: string;
        };
        Relationships: [];
      };
      influencer_models: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          traits: Json;
          prompt: string;
          portrait_path: string | null;
          full_body_path: string | null;
          status: "processing" | "completed" | "failed";
          credits_charged: number;
          credits_refunded_at: string | null;
          failure_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          traits: Json;
          prompt: string;
          portrait_path?: string | null;
          full_body_path?: string | null;
          status?: "processing" | "completed" | "failed";
          credits_charged?: number;
          credits_refunded_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          traits?: Json;
          prompt?: string;
          portrait_path?: string | null;
          full_body_path?: string | null;
          status?: "processing" | "completed" | "failed";
          credits_charged?: number;
          credits_refunded_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      social_posts: {
        Row: {
          id: string;
          user_id: string;
          model_id: string | null;
          model_name: string;
          platform: string | null;
          platforms: string[];
          format: string;
          campaign: string;
          product: string;
          goal: string;
          scene: string;
          tone: string;
          call_to_action: string;
          language: string;
          hashtag_count: number;
          caption: string;
          hashtags: string[];
          image_path: string;
          zernio_post_id: string | null;
          status: "draft" | "scheduled" | "ready_to_publish";
          scheduled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          model_id?: string | null;
          model_name: string;
          platform?: string | null;
          platforms?: string[];
          format: string;
          campaign: string;
          product: string;
          goal: string;
          scene: string;
          tone: string;
          call_to_action: string;
          language: string;
          hashtag_count: number;
          caption: string;
          hashtags?: string[];
          image_path: string;
          zernio_post_id?: string | null;
          status: "draft" | "scheduled" | "ready_to_publish";
          scheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          model_id?: string | null;
          model_name?: string;
          platform?: string | null;
          platforms?: string[];
          format?: string;
          campaign?: string;
          product?: string;
          goal?: string;
          scene?: string;
          tone?: string;
          call_to_action?: string;
          language?: string;
          hashtag_count?: number;
          caption?: string;
          hashtags?: string[];
          image_path?: string;
          zernio_post_id?: string | null;
          status?: "draft" | "scheduled" | "ready_to_publish";
          scheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reserve_influencer_generation: {
        Args: { p_name: string; p_traits: Json; p_prompt: string };
        Returns: { generation_id: string; remaining_credits: number }[];
      };
      refund_influencer_generation: {
        Args: { p_generation_id: string; p_failure_reason: string };
        Returns: number;
      };
      complete_influencer_generation: {
        Args: {
          p_generation_id: string;
          p_portrait_path: string;
          p_full_body_path: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
