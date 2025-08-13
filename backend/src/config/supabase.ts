import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let supabaseServiceClient: ReturnType<typeof createClient> | null = null;

export const initializeSupabase = () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      logger.warn('Supabase credentials not found in environment variables');
      return;
    }

    // Create public client (for client-side operations)
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });

    // Create service client (for server-side operations with full access)
    supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });

    logger.info('Supabase clients initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase:', error);
    throw error;
  }
};

// Get the public Supabase client
export const getSupabaseClient = () => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return supabaseClient;
};

// Get the service Supabase client (with elevated privileges)
export const getSupabaseServiceClient = () => {
  if (!supabaseServiceClient) {
    throw new Error('Supabase service client not initialized. Call initializeSupabase() first.');
  }
  return supabaseServiceClient;
};

// Database types (these would be generated from your database schema)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          company_name: string | null;
          phone: string | null;
          role: 'user' | 'admin' | 'super_admin';
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
          settings: Record<string, any>;
          metadata: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string | null;
          status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
          vendor_name: string;
          vendor_address: string | null;
          vendor_email: string | null;
          vendor_phone: string | null;
          vendor_tax_id: string | null;
          customer_name: string;
          customer_address: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          customer_tax_id: string | null;
          currency: string;
          subtotal: number;
          tax_amount: number;
          tax_rate: number;
          discount_amount: number;
          discount_rate: number;
          shipping_amount: number;
          total_amount: number;
          paid_amount: number;
          balance_due: number;
          payment_terms: string | null;
          notes: string | null;
          internal_notes: string | null;
          tags: string[] | null;
          original_file_url: string | null;
          processed_file_url: string | null;
          ocr_confidence_score: number | null;
          ai_extracted_data: Record<string, any> | null;
          processing_status: 'pending' | 'processing' | 'completed' | 'failed';
          processing_errors: Record<string, any> | null;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
          viewed_at: string | null;
          paid_at: string | null;
          metadata: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at' | 'balance_due'>;
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };
      line_items: {
        Row: {
          id: string;
          invoice_id: string;
          item_order: number;
          description: string;
          sku: string | null;
          quantity: number;
          unit_price: number;
          unit: string;
          tax_rate: number;
          tax_amount: number;
          discount_rate: number;
          discount_amount: number;
          total_amount: number;
          notes: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['line_items']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_amount'>;
        Update: Partial<Database['public']['Tables']['line_items']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          request_id: string | null;
          message_type: 'user' | 'assistant' | 'system' | 'error';
          content: string;
          role: string;
          related_invoice_id: string | null;
          related_entity_type: string | null;
          related_entity_id: string | null;
          ai_model: string | null;
          tokens_used: number | null;
          processing_time_ms: number | null;
          confidence_score: number | null;
          context: Record<string, any>;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          old_values: Record<string, any> | null;
          new_values: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      payment_transactions: {
        Row: {
          id: string;
          invoice_id: string;
          amount: number;
          payment_method: 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'other';
          payment_date: string;
          reference_number: string | null;
          notes: string | null;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payment_transactions']['Insert']>;
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_hash: string;
          last_used_at: string | null;
          expires_at: string | null;
          is_active: boolean;
          permissions: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['api_keys']['Insert']>;
      };
    };
    Views: {
      invoice_summaries: {
        Row: {
          id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string | null;
          status: string;
          vendor_name: string;
          customer_name: string;
          total_amount: number;
          paid_amount: number;
          balance_due: number;
          currency: string;
          user_name: string;
          user_company: string | null;
          line_item_count: number;
          is_overdue: boolean;
          days_until_due: number | null;
        };
      };
      unpaid_invoices: {
        Row: Database['public']['Views']['invoice_summaries']['Row'];
      };
    };
    Functions: {
      calculate_invoice_totals: {
        Args: { invoice_uuid: string };
        Returns: void;
      };
      get_revenue_summary: {
        Args: {
          p_user_id: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: {
          total_revenue: number;
          paid_revenue: number;
          unpaid_revenue: number;
          invoice_count: number;
          paid_count: number;
          unpaid_count: number;
          average_invoice_amount: number;
          overdue_amount: number;
          overdue_count: number;
        }[];
      };
      create_sample_invoice: {
        Args: { p_user_id: string };
        Returns: string;
      };
      process_natural_language_query: {
        Args: {
          p_user_id: string;
          p_query: string;
          p_session_id: string;
        };
        Returns: Record<string, any>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];