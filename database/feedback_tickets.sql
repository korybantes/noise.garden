-- Feedback tickets table
CREATE TABLE IF NOT EXISTS feedback_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('feedback', 'bug_report', 'support', 'feature_request')),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_user_id ON feedback_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status ON feedback_tickets(status);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_priority ON feedback_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_type ON feedback_tickets(type);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_assigned_to ON feedback_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_created_at ON feedback_tickets(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feedback_tickets_updated_at
    BEFORE UPDATE ON feedback_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_tickets_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE feedback_tickets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tickets
CREATE POLICY "Users can view own feedback tickets" ON feedback_tickets
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only create tickets for themselves
CREATE POLICY "Users can create own feedback tickets" ON feedback_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins, moderators, and community managers can view all tickets
CREATE POLICY "Staff can view all feedback tickets" ON feedback_tickets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'moderator', 'community_manager')
        )
    );

-- Admins, moderators, and community managers can update ticket status
CREATE POLICY "Staff can update feedback tickets" ON feedback_tickets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'moderator', 'community_manager')
        )
    ); 