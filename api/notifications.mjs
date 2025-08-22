import { neon } from '@neondatabase/serverless';
import { setSecurityHeaders, rateLimit, getAuthUser, validateInput, sanitizeSQL, sanitizeHTML, logSecurityEvent } from './security.mjs';

const sql = neon(process.env.NEON_DB);

const notificationRules = {
  limit: { type: 'number', min: 1, max: 100, required: false },
  notificationId: { type: 'string', minLength: 1, maxLength: 100, required: false },
  toUserId: { type: 'string', minLength: 1, maxLength: 100, required: false },
  type: { type: 'string', minLength: 1, maxLength: 20, required: false },
  postId: { type: 'string', minLength: 1, maxLength: 100, required: false },
  fromUsername: { type: 'string', minLength: 1, maxLength: 50, required: false }
};

export async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set security headers
  setSecurityHeaders(res);

  // Rate limiting
  const rateLimitResult = await rateLimit(req, res, 'notifications');
  if (rateLimitResult.limited) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { action, args = {} } = req.body;

    // Get authenticated user
    const user = await getAuthUser(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is banned
    if (user.banned) {
      logSecurityEvent('banned_user_attempt', { userId: user.userId, action });
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Validate input
    const validation = validateInput(args, notificationRules);
    if (!validation.valid) {
      logSecurityEvent('validation_error', { userId: user.userId, action, errors: validation.errors });
      return res.status(400).json({ error: 'Invalid input', details: validation.errors });
    }

    // Sanitize input
    const sanitizedArgs = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        sanitizedArgs[key] = sanitizeHTML(sanitizeSQL(value));
      } else {
        sanitizedArgs[key] = value;
      }
    }

    switch (action) {
      case 'getNotifications':
        return await getNotifications(res, user, sanitizedArgs);
      case 'markAsRead':
        return await markAsRead(res, user, sanitizedArgs);
      case 'markAllAsRead':
        return await markAllAsRead(res, user);
      case 'createNotification':
        return await createNotification(res, user, sanitizedArgs);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Notifications API error:', error);
    logSecurityEvent('api_error', { action: req.body?.action, error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getNotifications(res, user, args) {
  const limit = args.limit || 20;

  try {
    // Get notifications for the user
    const notifications = await sql`
      SELECT 
        id,
        type,
        post_id,
        from_user_id,
        from_username,
        created_at,
        read
      FROM notifications
      WHERE to_user_id = ${user.userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    // Get unread count
    const unreadResult = await sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE to_user_id = ${user.userId} AND read = FALSE
    `;

    const unreadCount = unreadResult[0]?.count || 0;

    return res.status(200).json({
      notifications: notifications || [],
      unreadCount: parseInt(unreadCount)
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
}

async function markAsRead(res, user, args) {
  const { notificationId } = args;

  if (!notificationId) {
    return res.status(400).json({ error: 'Notification ID is required' });
  }

  try {
    await sql`
      UPDATE notifications
      SET read = TRUE
      WHERE id = ${notificationId} AND to_user_id = ${user.userId}
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

async function markAllAsRead(res, user) {
  try {
    await sql`
      UPDATE notifications
      SET read = TRUE
      WHERE to_user_id = ${user.userId} AND read = FALSE
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
}

async function createNotification(res, user, args) {
  const { toUserId, type, postId, fromUsername } = args;

  if (!toUserId || !type || !postId || !fromUsername) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await sql`
      INSERT INTO notifications (to_user_id, from_user_id, type, post_id, from_username)
      VALUES (${toUserId}, ${user.userId}, ${type}, ${postId}, ${fromUsername})
      RETURNING id
    `;

    return res.status(200).json({ 
      success: true, 
      notificationId: result[0]?.id 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({ error: 'Failed to create notification' });
  }
} 