// Role-Based Access Control Implementation
// Based on SECURITY_PROTOCOLS.md Section 1.1

const ROLES = {
  SUPER_ADMIN: {
    level: 100,
    permissions: ['*'], // All permissions
    description: 'Full system access',
    requires2FA: true,
    requiresIPWhitelist: true,
    maxSessions: 2
  },
  ADMIN: {
    level: 80,
    permissions: [
      'attacks.*',
      'targets.*',
      'results.*',
      'config.read',
      'config.write',
      'logs.read',
      'users.manage',
      'webhooks.*',
      'system.update'
    ],
    description: 'Administrative access',
    requires2FA: true,
    requiresIPWhitelist: false,
    maxSessions: 3
  },
  SECURITY_ANALYST: {
    level: 60,
    permissions: [
      'attacks.read',
      'attacks.execute',
      'targets.read',
      'targets.create',
      'results.read',
      'results.export',
      'logs.read',
      'webhooks.read'
    ],
    description: 'Security testing and analysis',
    requires2FA: true,
    requiresIPWhitelist: false,
    maxSessions: 3
  },
  AUDITOR: {
    level: 40,
    permissions: [
      'attacks.read',
      'targets.read',
      'results.read',
      'logs.read',
      'config.read'
    ],
    description: 'Read-only audit access',
    requires2FA: true,
    requiresIPWhitelist: false,
    maxSessions: 2
  },
  VIEWER: {
    level: 20,
    permissions: [
      'attacks.read',
      'results.read',
      'logs.read'
    ],
    description: 'Limited read access',
    requires2FA: false,
    requiresIPWhitelist: false,
    maxSessions: 5
  }
};

/**
 * Check if user has specific permission
 * @param {Object} user - User object with role property
 * @param {string} permission - Permission to check (e.g., 'attacks.execute')
 * @returns {boolean}
 */
function hasPermission(user, permission) {
  if (!user || !user.role) {
    return false;
  }
  
  const role = ROLES[user.role];
  if (!role) {
    return false;
  }
  
  // Super admin has all permissions
  if (role.permissions.includes('*')) {
    return true;
  }
  
  // Check exact permission
  if (role.permissions.includes(permission)) {
    return true;
  }
  
  // Check wildcard permissions (e.g., 'attacks.*' matches 'attacks.read')
  const [resource, action] = permission.split('.');
  const wildcardPermission = `${resource}.*`;
  
  return role.permissions.includes(wildcardPermission);
}

/**
 * Get minimum role level required for a permission
 * @param {string} permission
 * @returns {number}
 */
function getRequiredLevel(permission) {
  for (const [roleName, roleConfig] of Object.entries(ROLES)) {
    if (roleConfig.permissions.includes('*') || 
        roleConfig.permissions.includes(permission) ||
        roleConfig.permissions.includes(permission.split('.')[0] + '.*')) {
      return roleConfig.level;
    }
  }
  return 100; // Require super admin if not found
}

/**
 * Permission enforcement middleware
 * @param {string} permission - Required permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: req.user.role
      });
    }
    
    next();
  };
}

/**
 * Role enforcement middleware
 * @param {string|string[]} allowedRoles - Role(s) required
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: roles,
        userRole: req.user.role
      });
    }
    
    next();
  };
}

/**
 * Level-based enforcement middleware
 * @param {number} requiredLevel - Minimum role level required
 */
function requireLevel(requiredLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const role = ROLES[req.user.role];
    if (!role || role.level < requiredLevel) {
      return res.status(403).json({ 
        error: 'Insufficient access level',
        required: requiredLevel,
        userLevel: role ? role.level : 0
      });
    }
    
    next();
  };
}

module.exports = {
  ROLES,
  hasPermission,
  getRequiredLevel,
  requirePermission,
  requireRole,
  requireLevel
};
