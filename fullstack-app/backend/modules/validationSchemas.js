/**
 * Validation Schemas Module
 * Joi validation schemas for request validation
 * @module validationSchemas
 */

const Joi = require('joi');

/**
 * User registration schema
 */
const userRegistrationSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must only contain alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be at most 30 characters long',
      'any.required': 'Username is required'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Must be a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must be at most 128 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    })
});

/**
 * User login schema
 */
const userLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Must be a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  
  rememberMe: Joi.boolean()
    .optional()
});

/**
 * Attack configuration schema
 */
const attackConfigSchema = Joi.object({
  target: Joi.alternatives()
    .try(
      Joi.string().ip(),
      Joi.string().domain()
    )
    .required()
    .messages({
      'any.required': 'Target is required',
      'alternatives.match': 'Target must be a valid IP address or domain name'
    }),
  
  attackType: Joi.string()
    .valid('ssh', 'ftp', 'http', 'https', 'smtp', 'mysql', 'postgresql', 'rdp', 'vnc', 'telnet', 'pop3', 'imap')
    .required()
    .messages({
      'any.only': 'Invalid attack type',
      'any.required': 'Attack type is required'
    }),
  
  port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .optional()
    .messages({
      'number.min': 'Port must be between 1 and 65535',
      'number.max': 'Port must be between 1 and 65535'
    }),
  
  username: Joi.string()
    .min(1)
    .max(255)
    .optional(),
  
  usernameList: Joi.string()
    .optional(),
  
  passwordList: Joi.string()
    .required()
    .messages({
      'any.required': 'Password list is required'
    }),
  
  threads: Joi.number()
    .integer()
    .min(1)
    .max(64)
    .default(4)
    .messages({
      'number.min': 'Threads must be between 1 and 64',
      'number.max': 'Threads must be between 1 and 64'
    }),
  
  timeout: Joi.number()
    .integer()
    .min(1)
    .max(300)
    .default(30)
    .messages({
      'number.min': 'Timeout must be between 1 and 300 seconds',
      'number.max': 'Timeout must be between 1 and 300 seconds'
    }),
  
  verbose: Joi.boolean()
    .default(false),
  
  priority: Joi.boolean()
    .default(false),
  
  options: Joi.object()
    .optional()
});

/**
 * DNS analysis schema
 */
const dnsAnalysisSchema = Joi.object({
  domain: Joi.string()
    .domain()
    .required()
    .messages({
      'string.domain': 'Must be a valid domain name',
      'any.required': 'Domain is required'
    }),
  
  includeSubdomains: Joi.boolean()
    .default(false),
  
  recordTypes: Joi.array()
    .items(Joi.string().valid('A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA', 'CNAME'))
    .optional()
});

/**
 * Credential storage schema
 */
const credentialSchema = Joi.object({
  attackId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid attack ID format',
      'any.required': 'Attack ID is required'
    }),
  
  target: Joi.alternatives()
    .try(
      Joi.string().ip(),
      Joi.string().domain()
    )
    .required()
    .messages({
      'any.required': 'Target is required'
    }),
  
  service: Joi.string()
    .required()
    .messages({
      'any.required': 'Service is required'
    }),
  
  port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .optional(),
  
  username: Joi.string()
    .required()
    .messages({
      'any.required': 'Username is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  
  additionalInfo: Joi.object()
    .optional()
});

/**
 * Search/filter schema
 */
const searchSchema = Joi.object({
  query: Joi.string()
    .min(1)
    .max(255)
    .optional(),
  
  service: Joi.string()
    .optional(),
  
  target: Joi.string()
    .optional(),
  
  verified: Joi.boolean()
    .optional(),
  
  active: Joi.boolean()
    .default(true),
  
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Page must be at least 1'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must be at most 100'
    }),
  
  sortBy: Joi.string()
    .valid('created_at', 'updated_at', 'target', 'service')
    .default('created_at'),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
});

/**
 * Export schema
 */
const exportSchema = Joi.object({
  format: Joi.string()
    .valid('json', 'csv', 'pdf', 'excel', 'xlsx')
    .required()
    .messages({
      'any.only': 'Invalid export format',
      'any.required': 'Export format is required'
    }),
  
  filename: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Filename can only contain letters, numbers, hyphens, and underscores'
    }),
  
  includePasswords: Joi.boolean()
    .default(false),
  
  filters: Joi.object()
    .optional()
});

/**
 * Notification settings schema
 */
const notificationSettingsSchema = Joi.object({
  email: Joi.object({
    enabled: Joi.boolean().required(),
    address: Joi.string().email().required(),
    events: Joi.array()
      .items(Joi.string().valid('attack_complete', 'attack_failed', 'credentials_discovered'))
      .required()
  }).optional(),
  
  webhook: Joi.object({
    enabled: Joi.boolean().required(),
    url: Joi.string().uri().required(),
    events: Joi.array()
      .items(Joi.string().valid('attack_complete', 'attack_failed', 'credentials_discovered'))
      .required()
  }).optional()
});

/**
 * Analytics report schema
 */
const analyticsReportSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Start date must be in ISO format'
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.format': 'End date must be in ISO format',
      'date.min': 'End date must be after start date'
    }),
  
  groupBy: Joi.string()
    .valid('day', 'week', 'month')
    .default('day'),
  
  includeCharts: Joi.boolean()
    .default(true)
});

/**
 * User profile update schema
 */
const userProfileUpdateSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .optional()
    .messages({
      'string.alphanum': 'Username must only contain alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be at most 30 characters long'
    }),
  
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Must be a valid email address'
    }),
  
  currentPassword: Joi.string()
    .when('newPassword', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Current password is required when changing password'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .optional()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  
  twoFactorEnabled: Joi.boolean()
    .optional(),
  
  notificationSettings: notificationSettingsSchema.optional()
});

/**
 * Pagination schema
 */
const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
});

/**
 * UUID parameter schema
 */
const uuidParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid ID format',
      'any.required': 'ID is required'
    })
});

/**
 * Date range schema
 */
const dateRangeSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'Start date must be in ISO format',
      'any.required': 'Start date is required'
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'date.format': 'End date must be in ISO format',
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required'
    })
});

/**
 * Validate data against schema
 * @param {Object} data - Data to validate
 * @param {Joi.Schema} schema - Joi schema
 * @returns {Object} Validation result
 */
const validate = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      value: null
    };
  }

  return {
    valid: true,
    errors: [],
    value
  };
};

/**
 * Express middleware for schema validation
 * @param {Joi.Schema} schema - Joi schema
 * @param {string} property - Request property to validate (body, query, params)
 * @returns {Function} Express middleware
 */
const validateMiddleware = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req[property] = value;
    next();
  };
};

/**
 * Sanitize input string
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
};

module.exports = {
  // Schemas
  userRegistrationSchema,
  userLoginSchema,
  attackConfigSchema,
  dnsAnalysisSchema,
  credentialSchema,
  searchSchema,
  exportSchema,
  notificationSettingsSchema,
  analyticsReportSchema,
  userProfileUpdateSchema,
  paginationSchema,
  uuidParamSchema,
  dateRangeSchema,
  
  // Validation functions
  validate,
  validateMiddleware,
  
  // Sanitization functions
  sanitizeString,
  sanitizeObject
};
