import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map();
const MAX_REQUESTS_PER_MINUTE = 60;
const MAX_REQUESTS_PER_HOUR = 1000;
const MAX_SIGNUP_ATTEMPTS_PER_HOUR = 5;
const MAX_LOGIN_ATTEMPTS_PER_HOUR = 10;

// Security headers
export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;");
}

// Rate limiting middleware
export function rateLimit(req, res, identifier) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const hour = Math.floor(now / 3600000);
  
  const minuteKey = `${identifier}:minute:${minute}`;
  const hourKey = `${identifier}:hour:${hour}`;
  
  // Clean old entries
  for (const [key] of rateLimitStore) {
    if (key.includes(':minute:') && !key.includes(`:minute:${minute}`)) {
      rateLimitStore.delete(key);
    }
    if (key.includes(':hour:') && !key.includes(`:hour:${hour}`)) {
      rateLimitStore.delete(key);
    }
  }
  
  // Check minute limit
  const minuteCount = rateLimitStore.get(minuteKey) || 0;
  if (minuteCount >= MAX_REQUESTS_PER_MINUTE) {
    res.status(429).json({ error: 'rate_limit_exceeded', message: 'Too many requests per minute' });
    return false;
  }
  
  // Check hour limit
  const hourCount = rateLimitStore.get(hourKey) || 0;
  if (hourCount >= MAX_REQUESTS_PER_HOUR) {
    res.status(429).json({ error: 'rate_limit_exceeded', message: 'Too many requests per hour' });
    return false;
  }
  
  // Update counters
  rateLimitStore.set(minuteKey, minuteCount + 1);
  rateLimitStore.set(hourKey, hourCount + 1);
  
  return true;
}

// Enhanced authentication with rate limiting
export async function getAuthUser(req, res) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const authKey = `auth:${clientIP}`;
  
  // Rate limit authentication attempts
  if (!rateLimit(req, res, authKey)) {
    return null;
  }
  
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (!token) return null;
  
  try {
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || 'anonymous_social_secret_key_change_in_production');
    const { payload } = await jwtVerify(token, secretKey);
    
    // Validate payload structure
    if (!payload.userId || !payload.username || !payload.role) {
      return null;
    }
    
    // Check if user is banned
    const dbUrl = process.env.NEON_DB || process.env.VITE_NEON_DB || process.env.DATABASE_URL;
    const sql = neon(dbUrl);
    const banCheck = await sql`SELECT banned FROM banned_users WHERE user_id = ${payload.userId}`;
    
    if (banCheck.length > 0) {
      return null; // Banned user
    }
    
    return { 
      userId: String(payload.userId), 
      username: String(payload.username), 
      role: String(payload.role) 
    };
  } catch (error) {
    console.error('Auth error:', error.message);
    return null;
  }
}

// Input validation and sanitization
export function validateInput(input, rules) {
  const errors = [];
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = input[field];
    
    if (rule.required && (!value || value.trim() === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value) {
      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must be at most ${rule.maxLength} characters`);
      }
      
      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
      
      // Custom validation
      if (rule.custom) {
        const customError = rule.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }
  }
  
  return errors;
}

// Username validation rules
export const usernameRules = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_-]+$/,
    custom: (value) => {
      if (value.toLowerCase().includes('admin') || value.toLowerCase().includes('moderator')) {
        return 'Username cannot contain reserved words';
      }
      return null;
    }
  }
};

// Password validation rules
export const passwordRules = {
  password: {
    required: true,
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    custom: (value) => {
      if (value.length < 8) {
        return 'Password must be at least 8 characters';
      }
      if (!/[A-Z]/.test(value)) {
        return 'Password must contain at least one uppercase letter';
      }
      if (!/[a-z]/.test(value)) {
        return 'Password must contain at least one lowercase letter';
      }
      if (!/\d/.test(value)) {
        return 'Password must contain at least one number';
      }
      return null;
    }
  }
};

// Content validation rules
export const contentRules = {
  content: {
    required: true,
    maxLength: 280,
    custom: (value) => {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /data:text\/html/i,
        /vbscript:/i
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return 'Content contains disallowed patterns';
        }
      }
      
      return null;
    }
  }
};

// Invite code validation
export const inviteRules = {
  invite: {
    required: true,
    pattern: /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/,
    custom: (value) => {
      if (!value.match(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/)) {
        return 'Invalid invite code format';
      }
      return null;
    }
  }
};

// SQL injection prevention
export function sanitizeSQL(value) {
  if (typeof value !== 'string') return value;
  
  // Remove SQL injection patterns
  const dangerousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\b(and|or)\b\s+\d+\s*=\s*\d+)/gi,
    /(\b(and|or)\b\s+['"]\w+['"]\s*=\s*['"]\w+['"])/gi
  ];
  
  let sanitized = value;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized.trim();
}

// XSS prevention
export function sanitizeHTML(value) {
  if (typeof value !== 'string') return value;
  
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Logging for security events
export function logSecurityEvent(event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details,
    userAgent: details.userAgent || 'unknown',
    ip: details.ip || 'unknown'
  };
  
  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
  
  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to external security monitoring
    // Example: sendToSecurityService(logEntry);
  }
}

// Check for suspicious activity
export function detectSuspiciousActivity(req, user) {
  const suspicious = [];
  
  // Check user agent
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent || userAgent.length < 10) {
    suspicious.push('Suspicious user agent');
  }
  
  // Check for rapid requests
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const rapidKey = `rapid:${clientIP}`;
  const rapidCount = rateLimitStore.get(rapidKey) || 0;
  
  if (rapidCount > 100) {
    suspicious.push('Rapid request pattern detected');
  }
  
  // Log suspicious activity
  if (suspicious.length > 0) {
    logSecurityEvent('suspicious_activity', {
      ip: clientIP,
      userAgent,
      userId: user?.userId,
      username: user?.username,
      suspicious
    });
  }
  
  return suspicious;
} 