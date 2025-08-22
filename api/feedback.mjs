import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';
import { rateLimit, getAuthUser, validateInput, sanitizeHTML, logSecurityEvent } from './security.mjs';

const sql = neon(process.env.NEON_DB);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Feedback ticket validation rules
const feedbackRules = {
  type: { required: true, type: 'string', enum: ['feedback', 'bug_report', 'support', 'feature_request'] },
  title: { required: true, type: 'string', minLength: 3, maxLength: 100 },
  description: { required: true, type: 'string', minLength: 10, maxLength: 1000 },
  priority: { required: true, type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }
};

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate limiting
    const authUser = await getAuthUser(req, res);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimit(req, res, `feedback_${authUser.userId}`);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const { action, args } = req.body;

    switch (action) {
      case 'createTicket':
        return await createTicket(req, res, authUser, args);
      
      case 'getFeedbackTickets':
        return await getFeedbackTickets(req, res, authUser, args);
      
      case 'updateTicketStatus':
        return await updateTicketStatus(req, res, authUser, args);
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Feedback API error:', error);
    logSecurityEvent('feedback_api_error', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createTicket(req, res, authUser, args) {
  // Validate input
  const validation = validateInput(args, feedbackRules);
  if (!validation.valid) {
    logSecurityEvent('feedback_validation_error', { 
      userId: authUser.userId, 
      errors: validation.errors 
    });
    return res.status(400).json({ error: 'Invalid input', details: validation.errors });
  }

  // Check if user is banned
  const bannedCheck = await sql`
    SELECT banned_until FROM users WHERE id = ${authUser.userId}
  `;
  
  if (bannedCheck.length > 0 && bannedCheck[0].banned_until && new Date(bannedCheck[0].banned_until) > new Date()) {
    return res.status(403).json({ error: 'Account is banned' });
  }

  try {
    // Sanitize inputs
    const sanitizedTitle = sanitizeHTML(args.title);
    const sanitizedDescription = sanitizeHTML(args.description);

    // Create ticket
    const result = await sql`
      INSERT INTO feedback_tickets (
        user_id, 
        type, 
        title, 
        description, 
        priority, 
        status, 
        created_at, 
        updated_at
      ) VALUES (
        ${authUser.userId},
        ${args.type},
        ${sanitizedTitle},
        ${sanitizedDescription},
        ${args.priority},
        'open',
        NOW(),
        NOW()
      ) RETURNING id
    `;

    logSecurityEvent('feedback_ticket_created', {
      userId: authUser.userId,
      ticketId: result[0].id,
      type: args.type,
      priority: args.priority
    });

    return res.status(201).json({ 
      success: true, 
      ticketId: result[0].id,
      message: 'Ticket created successfully' 
    });
  } catch (error) {
    console.error('Error creating feedback ticket:', error);
    logSecurityEvent('feedback_ticket_creation_error', {
      userId: authUser.userId,
      error: error.message
    });
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
}

async function getFeedbackTickets(req, res, authUser, args) {
  // Check if user has permission to view tickets
  if (!['admin', 'moderator', 'community_manager'].includes(authUser.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const tickets = await sql`
      SELECT 
        ft.id,
        ft.user_id,
        u.username,
        ft.type,
        ft.title,
        ft.description,
        ft.status,
        ft.priority,
        ft.created_at,
        ft.updated_at,
        ft.assigned_to,
        au.username as assigned_username
      FROM feedback_tickets ft
      LEFT JOIN users u ON ft.user_id = u.id
      LEFT JOIN users au ON ft.assigned_to = au.id
      ORDER BY 
        CASE ft.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        ft.created_at DESC
    `;

    return res.status(200).json({ 
      success: true, 
      tickets: tickets.map(ticket => ({
        ...ticket,
        created_at: ticket.created_at.toISOString(),
        updated_at: ticket.updated_at.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching feedback tickets:', error);
    logSecurityEvent('feedback_tickets_fetch_error', {
      userId: authUser.userId,
      error: error.message
    });
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
}

async function updateTicketStatus(req, res, authUser, args) {
  // Check if user has permission to update tickets
  if (!['admin', 'moderator', 'community_manager'].includes(authUser.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Validate input
  if (!args.ticketId || !args.status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(args.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await sql`
      UPDATE feedback_tickets 
      SET 
        status = ${args.status},
        updated_at = NOW(),
        assigned_to = CASE 
          WHEN ${args.status} = 'in_progress' AND assigned_to IS NULL 
          THEN ${authUser.userId}
          ELSE assigned_to
        END
      WHERE id = ${args.ticketId}
      RETURNING id, status
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    logSecurityEvent('feedback_ticket_status_updated', {
      userId: authUser.userId,
      ticketId: args.ticketId,
      newStatus: args.status
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Ticket status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    logSecurityEvent('feedback_ticket_status_update_error', {
      userId: authUser.userId,
      ticketId: args.ticketId,
      error: error.message
    });
    return res.status(500).json({ error: 'Failed to update ticket status' });
  }
} 