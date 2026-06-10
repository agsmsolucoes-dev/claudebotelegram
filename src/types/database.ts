// Tipos manuais espelhando supabase/migrations/0001_init.sql.
// TODO: trocar por `supabase gen types typescript --linked` assim que o projeto
// Supabase real estiver criado e linkado.

export type OfferPeriod = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";
export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded";
export type WithdrawalStatus = "pending" | "processing" | "completed" | "failed";

export interface Database {
  public: {
    Tables: {
      creators: {
        Row: {
          id: string;
          email: string;
          name: string;
          support_contact: string | null;
          commission_pct: number;
          commission_fixed: number;
          payout_account: Record<string, unknown> | null;
          auto_withdraw: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["creators"]["Row"]> & {
          email: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["creators"]["Row"]>;
        Relationships: [];
      };
      bots: {
        Row: {
          id: string;
          creator_id: string;
          bot_token: string;
          bot_username: string;
          webhook_secret: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bots"]["Row"]> & {
          creator_id: string;
          bot_token: string;
          bot_username: string;
        };
        Update: Partial<Database["public"]["Tables"]["bots"]["Row"]>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          creator_id: string;
          bot_id: string;
          telegram_chat_id: number;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["groups"]["Row"]> & {
          creator_id: string;
          bot_id: string;
          telegram_chat_id: number;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Row"]>;
        Relationships: [];
      };
      offers: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          period: OfferPeriod;
          price_amount: number;
          price_currency: string;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["offers"]["Row"]> & {
          group_id: string;
          name: string;
          period: OfferPeriod;
          price_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["offers"]["Row"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          offer_id: string;
          telegram_user_id: number;
          telegram_username: string | null;
          status: SubscriptionStatus;
          current_period_end: string | null;
          reminder_7d_sent_at: string | null;
          reminder_3d_sent_at: string | null;
          reminder_1d_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & {
          offer_id: string;
          telegram_user_id: number;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          subscription_id: string;
          reference_id: string;
          galiopay_payment_link_id: string | null;
          galiopay_payment_id: string | null;
          galiopay_proof_token: string | null;
          payment_url: string | null;
          status: PaymentStatus;
          amount: number;
          currency: string;
          commission_amount: number;
          net_amount: number;
          created_at: string;
          approved_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          subscription_id: string;
          reference_id: string;
          amount: number;
          commission_amount: number;
          net_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      withdrawals: {
        Row: {
          id: string;
          creator_id: string;
          amount: number;
          currency: string;
          status: WithdrawalStatus;
          requested_at: string;
          processed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["withdrawals"]["Row"]> & {
          creator_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["withdrawals"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      creator_balances: {
        Row: {
          creator_id: string;
          available_amount: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
