-- Supabase Migration: Initial Schema
-- Run this migration to set up the complete database structure

-- Note: Supabase already has auth.users table, so we'll extend it with profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Create a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', 'New User'));
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Include all the tables from the main schema
-- (Copy the rest of the tables from database-schema.sql but replace 'users' with 'profiles' in foreign keys)

-- Enable Realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE line_items;

-- Storage buckets for invoice files
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('invoices', 'invoices', false),
    ('invoice-attachments', 'invoice-attachments', false);

-- Storage policies
CREATE POLICY "Users can upload their own invoices"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id IN ('invoices', 'invoice-attachments') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own invoices"
ON storage.objects FOR SELECT
USING (
    bucket_id IN ('invoices', 'invoice-attachments') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own invoices"
ON storage.objects FOR UPDATE
USING (
    bucket_id IN ('invoices', 'invoice-attachments') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own invoices"
ON storage.objects FOR DELETE
USING (
    bucket_id IN ('invoices', 'invoice-attachments') 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create Edge Functions database functions
CREATE OR REPLACE FUNCTION process_natural_language_query(
    p_user_id UUID,
    p_query TEXT,
    p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- This function will be called by the Edge Function
    -- It processes natural language queries and returns structured data
    
    -- Log the query
    INSERT INTO messages (user_id, session_id, message_type, content, role)
    VALUES (p_user_id, p_session_id, 'user', p_query, 'user');
    
    -- Placeholder for AI processing results
    -- In production, this would interface with the Edge Function
    v_result = jsonb_build_object(
        'status', 'success',
        'message', 'Query processed',
        'data', jsonb_build_object()
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;