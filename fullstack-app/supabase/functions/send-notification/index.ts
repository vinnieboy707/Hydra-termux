// Send Notification Edge Function
// Sends email/SMS notifications for important events with template support and delivery tracking

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Notification types and templates
enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

enum NotificationEvent {
  ATTACK_COMPLETED = 'attack.completed',
  ATTACK_FAILED = 'attack.failed',
  CREDENTIALS_FOUND = 'credentials.found',
  SECURITY_ALERT = 'security.alert',
  SYSTEM_UPDATE = 'system.update'
}

interface NotificationTemplate {
  subject: string
  body: string
  priority: 'low' | 'medium' | 'high' | 'critical'
}

const EMAIL_TEMPLATES: Record<NotificationEvent, NotificationTemplate> = {
  [NotificationEvent.ATTACK_COMPLETED]: {
    subject: '✅ Attack Completed Successfully - {{host}}',
    body: `
Hello {{username}},

Your attack on {{host}}:{{port}} using {{protocol}} has completed successfully.

Results:
- Credentials Found: {{credentials_found}}
- Duration: {{duration}} seconds
- Status: {{status}}

View detailed results: {{results_url}}

Best regards,
Hydra-Termux Team
    `,
    priority: 'medium'
  },
  [NotificationEvent.ATTACK_FAILED]: {
    subject: '❌ Attack Failed - {{host}}',
    body: `
Hello {{username}},

Your attack on {{host}}:{{port}} using {{protocol}} has failed.

Error: {{error_message}}
Duration: {{duration}} seconds

Please check the logs for more details: {{logs_url}}

Best regards,
Hydra-Termux Team
    `,
    priority: 'high'
  },
  [NotificationEvent.CREDENTIALS_FOUND]: {
    subject: '🎯 Credentials Discovered - {{host}}',
    body: `
Hello {{username}},

SUCCESS! Credentials have been discovered on {{host}}:{{port}}

- Protocol: {{protocol}}
- Credentials Found: {{credentials_found}}
- Time: {{timestamp}}

⚠️ IMPORTANT: These are real credentials. Handle with care and follow responsible disclosure practices.

View credentials: {{results_url}}

Best regards,
Hydra-Termux Team
    `,
    priority: 'critical'
  },
  [NotificationEvent.SECURITY_ALERT]: {
    subject: '🚨 Security Alert - {{alert_type}}',
    body: `
Hello {{username}},

A security alert has been triggered for your account.

Alert Type: {{alert_type}}
Details: {{details}}
Time: {{timestamp}}

If this wasn't you, please secure your account immediately.

Best regards,
Hydra-Termux Team
    `,
    priority: 'critical'
  },
  [NotificationEvent.SYSTEM_UPDATE]: {
    subject: '📢 System Update - {{update_type}}',
    body: `
Hello {{username}},

{{update_message}}

Best regards,
Hydra-Termux Team
    `,
    priority: 'low'
  }
}

// Template variable replacement
function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
  }
  return rendered
}

// Send email via integration (Resend recommended for production)
async function sendEmail(
  to: string,
  subject: string,
  body: string,
  priority: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Production: Resend integration (https://resend.com)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured - email not sent');
      return { 
        success: false, 
        error: 'Email service not configured. Set RESEND_API_KEY environment variable.' 
      };
    }
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'Hydra-Termux <notifications@hydra-termux.app>',
        to: [to],
        subject,
        html: body.replace(/\n/g, '<br>'),
        tags: [
          { name: 'category', value: 'notification' },
          { name: 'priority', value: priority }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Email send failed:', error);
      return { success: false, error: `Email service error: ${error}` };
    }
    
    const result = await response.json();
    return { success: true, messageId: result.id };
    
  } catch (error) {
    console.error('Email exception:', error);
    return { success: false, error: error.message };
  }
}

// Send SMS via integration (Twilio recommended for production)
async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Production: Twilio integration (https://twilio.com)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured - SMS not sent');
      return { 
        success: false, 
        error: 'SMS service not configured. Set TWILIO_* environment variables.' 
      };
    }
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioPhoneNumber,
          To: to,
          Body: body.substring(0, 1600) // SMS limit
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('SMS send failed:', error);
      return { success: false, error: `SMS service error: ${error}` };
    }
    
    const result = await response.json();
    return { success: true, messageId: result.sid };
    
  } catch (error) {
    console.error('SMS exception:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, event_type, data, notification_types } = await req.json()

    if (!user_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user details and preferences
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('email, username, phone_number, notification_preferences')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get notification template
    const template = EMAIL_TEMPLATES[event_type as NotificationEvent]
    if (!template) {
      return new Response(
        JSON.stringify({ error: `No template found for event: ${event_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare template variables
    const variables = {
      username: user.username,
      timestamp: new Date().toISOString(),
      results_url: `${Deno.env.get('APP_URL')}/results`,
      logs_url: `${Deno.env.get('APP_URL')}/logs`,
      ...data
    }

    const subject = renderTemplate(template.subject, variables)
    const body = renderTemplate(template.body, variables)

    const results: any[] = []
    const types = notification_types || [NotificationType.EMAIL]

    // Send notifications based on user preferences and requested types
    for (const type of types) {
      if (type === NotificationType.EMAIL && user.email) {
        const result = await sendEmail(user.email, subject, body, template.priority)
        results.push({ 
          type, 
          success: result.success, 
          error: result.error,
          messageId: result.messageId 
        })
      } else if (type === NotificationType.SMS && user.phone_number) {
        const smsBody = `${subject}\n\n${body.substring(0, 300)}...` // Truncate for SMS
        const result = await sendSMS(user.phone_number, smsBody)
        results.push({ 
          type, 
          success: result.success, 
          error: result.error,
          messageId: result.messageId 
        })
      }
    }

    // Log notification
    await supabaseClient.from('logs').insert({
      user_id,
      level: 'info',
      message: `Notification sent: ${event_type}`,
      details: {
        event_type,
        notification_types: types,
        results,
        priority: template.priority
      },
      created_at: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        message: 'Notifications sent',
        user: user.username,
        results,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to send notification',
        message: error.message,
        type: error.name
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
