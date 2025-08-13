-- Intelligent Invoicing Database Schema
-- PostgreSQL/Supabase Database Design

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Invoices table for storing invoice data
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
    
    -- Vendor/Seller Information
    vendor_name VARCHAR(255) NOT NULL,
    vendor_address TEXT,
    vendor_email VARCHAR(255),
    vendor_phone VARCHAR(50),
    vendor_tax_id VARCHAR(100),
    
    -- Customer/Buyer Information
    customer_name VARCHAR(255) NOT NULL,
    customer_address TEXT,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_tax_id VARCHAR(100),
    
    -- Financial Information
    currency VARCHAR(3) DEFAULT 'USD',
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    discount_rate DECIMAL(5, 2) DEFAULT 0,
    shipping_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    balance_due DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    
    -- Additional Information
    payment_terms VARCHAR(100),
    notes TEXT,
    internal_notes TEXT,
    tags TEXT[],
    
    -- OCR and AI Processing
    original_file_url TEXT,
    processed_file_url TEXT,
    ocr_confidence_score DECIMAL(3, 2),
    ai_extracted_data JSONB,
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_errors JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Unique constraint for user and invoice number
    UNIQUE(user_id, invoice_number)
);

-- Line items table for invoice items
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    sku VARCHAR(100),
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'unit',
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_rate DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) GENERATED ALWAYS AS (
        (quantity * unit_price) - discount_amount + tax_amount
    ) STORED,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages/Conversations table for chat history
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    request_id UUID,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system', 'error')),
    content TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    
    -- Related entities
    related_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    
    -- AI Processing
    ai_model VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    confidence_score DECIMAL(3, 2),
    
    -- Context and metadata
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table for tracking all changes
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'paypal', 'stripe', 'other')),
    payment_date DATE NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API keys table for external integrations
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX idx_invoices_total_amount ON invoices(total_amount);
CREATE INDEX idx_invoices_processing_status ON invoices(processing_status);

CREATE INDEX idx_line_items_invoice_id ON line_items(invoice_id);
CREATE INDEX idx_line_items_description ON line_items(description);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_payment_date ON payment_transactions(payment_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals(invoice_uuid UUID)
RETURNS void AS $$
DECLARE
    v_subtotal DECIMAL(12, 2);
    v_tax_total DECIMAL(12, 2);
    v_discount_total DECIMAL(12, 2);
BEGIN
    -- Calculate subtotal from line items
    SELECT 
        COALESCE(SUM(quantity * unit_price), 0),
        COALESCE(SUM(tax_amount), 0),
        COALESCE(SUM(discount_amount), 0)
    INTO v_subtotal, v_tax_total, v_discount_total
    FROM line_items
    WHERE invoice_id = invoice_uuid;
    
    -- Update invoice totals
    UPDATE invoices
    SET 
        subtotal = v_subtotal,
        tax_amount = v_tax_total,
        discount_amount = v_discount_total,
        total_amount = v_subtotal + v_tax_total - v_discount_total + shipping_amount
    WHERE id = invoice_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_invoice_totals(OLD.invoice_id);
    ELSE
        PERFORM calculate_invoice_totals(NEW.invoice_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_totals_on_line_item_change
AFTER INSERT OR UPDATE OR DELETE ON line_items
FOR EACH ROW EXECUTE FUNCTION update_invoice_totals_trigger();

-- Create view for invoice summaries
CREATE VIEW invoice_summaries AS
SELECT 
    i.id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.status,
    i.vendor_name,
    i.customer_name,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    i.currency,
    u.full_name as user_name,
    u.company_name as user_company,
    COUNT(li.id) as line_item_count,
    CASE 
        WHEN i.due_date < CURRENT_DATE AND i.status NOT IN ('paid', 'cancelled') 
        THEN true 
        ELSE false 
    END as is_overdue,
    DATE_PART('day', i.due_date - CURRENT_DATE) as days_until_due
FROM invoices i
JOIN users u ON i.user_id = u.id
LEFT JOIN line_items li ON i.id = li.invoice_id
GROUP BY i.id, u.id;

-- Create view for unpaid invoices
CREATE VIEW unpaid_invoices AS
SELECT * FROM invoice_summaries
WHERE status NOT IN ('paid', 'cancelled')
AND balance_due > 0
ORDER BY due_date ASC;

-- Create function for revenue calculations
CREATE OR REPLACE FUNCTION get_revenue_summary(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_revenue DECIMAL(12, 2),
    paid_revenue DECIMAL(12, 2),
    unpaid_revenue DECIMAL(12, 2),
    invoice_count INTEGER,
    paid_count INTEGER,
    unpaid_count INTEGER,
    average_invoice_amount DECIMAL(12, 2),
    overdue_amount DECIMAL(12, 2),
    overdue_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_revenue,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN balance_due ELSE 0 END), 0) as unpaid_revenue,
        COUNT(*)::INTEGER as invoice_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END)::INTEGER as paid_count,
        COUNT(CASE WHEN status != 'paid' THEN 1 END)::INTEGER as unpaid_count,
        COALESCE(AVG(total_amount), 0) as average_invoice_amount,
        COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN balance_due ELSE 0 END), 0) as overdue_amount,
        COUNT(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN 1 END)::INTEGER as overdue_count
    FROM invoices
    WHERE user_id = p_user_id
    AND invoice_date BETWEEN p_start_date AND p_end_date
    AND status != 'cancelled';
END;
$$ LANGUAGE plpgsql;

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_policy ON users
    FOR ALL USING (auth.uid() = id);

CREATE POLICY invoices_policy ON invoices
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY line_items_policy ON line_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM invoices 
            WHERE invoices.id = line_items.invoice_id 
            AND invoices.user_id = auth.uid()
        )
    );

CREATE POLICY messages_policy ON messages
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY payment_transactions_policy ON payment_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM invoices 
            WHERE invoices.id = payment_transactions.invoice_id 
            AND invoices.user_id = auth.uid()
        )
    );

CREATE POLICY api_keys_policy ON api_keys
    FOR ALL USING (auth.uid() = user_id);

-- Audit logs can be read by users for their own actions
CREATE POLICY audit_logs_read_policy ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Only system can insert audit logs
CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Sample data insertion functions for testing
CREATE OR REPLACE FUNCTION create_sample_invoice(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
BEGIN
    -- Insert sample invoice
    INSERT INTO invoices (
        user_id, invoice_number, invoice_date, due_date, status,
        vendor_name, vendor_address, vendor_email,
        customer_name, customer_address, customer_email,
        currency, payment_terms
    ) VALUES (
        p_user_id, 
        'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || FLOOR(RANDOM() * 10000)::TEXT,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'draft',
        'Sample Vendor Inc.',
        '123 Vendor Street, City, State 12345',
        'vendor@example.com',
        'Sample Customer Corp.',
        '456 Customer Ave, City, State 67890',
        'customer@example.com',
        'USD',
        'Net 30'
    ) RETURNING id INTO v_invoice_id;
    
    -- Insert sample line items
    INSERT INTO line_items (invoice_id, item_order, description, quantity, unit_price, unit)
    VALUES 
        (v_invoice_id, 1, 'Professional Services - Consulting', 10, 150.00, 'hour'),
        (v_invoice_id, 2, 'Software License - Annual', 1, 1200.00, 'license'),
        (v_invoice_id, 3, 'Support and Maintenance', 12, 100.00, 'month');
    
    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;