-- Intelligent Invoicing System Database Schema
-- Created: 2024
-- Version: 1.0

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table for authentication and user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'
);

-- Create invoices table for storing main invoice information
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'disputed')),
    address TEXT,
    vendor_name VARCHAR(255),
    vendor_email VARCHAR(255),
    vendor_phone VARCHAR(50),
    issue_date DATE,
    due_date DATE,
    payment_date DATE,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    notes TEXT,
    original_filename VARCHAR(255),
    google_drive_file_id VARCHAR(255),
    processing_status VARCHAR(20) DEFAULT 'processed' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create invoice_line_items table for storing individual line items
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL REFERENCES invoices(invoice_number),
    item_description TEXT NOT NULL,
    quantity NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    category VARCHAR(100),
    tax_rate NUMERIC(5,4) DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    discount_rate NUMERIC(5,4) DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table for chat history
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    request_id VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_log table for tracking changes
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create file_uploads table for tracking uploaded files
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path TEXT,
    google_drive_file_id VARCHAR(255),
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'processing', 'processed', 'failed')),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create notifications table for user notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_processing_errors table for tracking processing failures
CREATE TABLE invoice_processing_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create payment_reminders table for automated payment reminders
CREATE TABLE payment_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('before_due', 'on_due', 'overdue')),
    days_offset INTEGER NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    email_template VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Invoices table indexes
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_amount ON invoices(amount);
CREATE INDEX idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);
CREATE INDEX idx_invoices_processing_status ON invoices(processing_status);

-- Invoice line items indexes
CREATE INDEX idx_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_invoice_number ON invoice_line_items(invoice_number);
CREATE INDEX idx_line_items_category ON invoice_line_items(category);
CREATE INDEX idx_line_items_amount ON invoice_line_items(amount);

-- Messages table indexes
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Audit log indexes
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- File uploads indexes
CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_status ON file_uploads(upload_status);
CREATE INDEX idx_file_uploads_invoice_id ON file_uploads(invoice_id);
CREATE INDEX idx_file_uploads_created_at ON file_uploads(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Invoice processing errors indexes
CREATE INDEX idx_processing_errors_file_id ON invoice_processing_errors(file_upload_id);
CREATE INDEX idx_processing_errors_resolved ON invoice_processing_errors(resolved);
CREATE INDEX idx_processing_errors_created_at ON invoice_processing_errors(created_at);

-- Payment reminders indexes
CREATE INDEX idx_payment_reminders_invoice_id ON payment_reminders(invoice_id);
CREATE INDEX idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX idx_payment_reminders_sent_at ON payment_reminders(sent_at);

-- Triggers for updated_at timestamps

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON invoice_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries

-- Create view for invoice summary with totals
CREATE VIEW invoice_summary AS
SELECT 
    i.id,
    i.invoice_number,
    i.amount,
    i.currency,
    i.status,
    i.vendor_name,
    i.issue_date,
    i.due_date,
    i.payment_date,
    i.user_id,
    i.created_at,
    COUNT(li.id) as line_item_count,
    SUM(li.amount) as calculated_total,
    CASE 
        WHEN i.due_date < CURRENT_DATE AND i.status = 'pending' THEN 'overdue'
        ELSE i.status 
    END as calculated_status
FROM invoices i
LEFT JOIN invoice_line_items li ON i.id = li.invoice_id
GROUP BY i.id, i.invoice_number, i.amount, i.currency, i.status, i.vendor_name, 
         i.issue_date, i.due_date, i.payment_date, i.user_id, i.created_at;

-- Create view for user statistics
CREATE VIEW user_invoice_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.company_name,
    COUNT(i.id) as total_invoices,
    SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) as pending_invoices,
    SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
    SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
    SUM(i.amount) as total_amount,
    SUM(CASE WHEN i.status = 'pending' THEN i.amount ELSE 0 END) as pending_amount,
    SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) as paid_amount,
    AVG(i.amount) as average_invoice_amount
FROM users u
LEFT JOIN invoices i ON u.id = i.user_id
GROUP BY u.id, u.email, u.company_name;

-- Stored procedures for common operations

-- Procedure to mark invoice as paid
CREATE OR REPLACE FUNCTION mark_invoice_paid(
    p_invoice_id UUID,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_payment_method VARCHAR(50) DEFAULT NULL,
    p_payment_reference VARCHAR(255) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE invoices 
    SET 
        status = 'paid',
        payment_date = p_payment_date,
        payment_method = p_payment_method,
        payment_reference = p_payment_reference,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Procedure to update invoice status based on due date
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE invoices 
    SET status = 'overdue', updated_at = NOW()
    WHERE status = 'pending' 
    AND due_date < CURRENT_DATE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password should be changed immediately)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
VALUES (
    'admin@intelligentinvoicing.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeC4Lgd1CJLQcOi9e', -- password: admin123
    'System',
    'Administrator',
    'admin',
    true,
    true
);

-- Grant permissions (adjust based on your PostgreSQL setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO intelligent_invoicing_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO intelligent_invoicing_user;

COMMENT ON TABLE users IS 'User accounts and authentication information';
COMMENT ON TABLE invoices IS 'Main invoice records with header information';
COMMENT ON TABLE invoice_line_items IS 'Individual line items for each invoice';
COMMENT ON TABLE messages IS 'Chat conversation history for AI interactions';
COMMENT ON TABLE audit_log IS 'Audit trail for all data changes';
COMMENT ON TABLE file_uploads IS 'Tracking of uploaded invoice files';
COMMENT ON TABLE notifications IS 'User notifications and alerts';
COMMENT ON TABLE invoice_processing_errors IS 'Error tracking for failed invoice processing';
COMMENT ON TABLE payment_reminders IS 'Automated payment reminder scheduling';

-- End of schema