// Shared email helpers used by both `send-custom-email` (user-JWT path) and
// `process-scheduled-emails` (service-role worker path).
import nodemailer from 'npm:nodemailer'
// deno-lint-ignore no-explicit-any
type SupabaseClient = any

export type Recipient = {
  contact_id: string | null
  email: string
  full_name: string
  company?: string
}

export type ResolvedSmtp = {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
  from: string
}

// Replace {{variables}} in a template with a recipient's values.
export function injectVariables(template: string, r: Recipient): string {
  return template
    .replace(/\{\{full_name\}\}/g, r.full_name)
    .replace(/\{\{email\}\}/g, r.email)
    .replace(/\{\{company_name\}\}/g, r.company ?? '')
}

// Resolve the SMTP config for a user: their saved smtp_configs row, else env vars.
export async function resolveSmtp(supabase: SupabaseClient, userId: string): Promise<ResolvedSmtp> {
  const { data: cfg } = await supabase
    .schema('crm')
    .from('smtp_configs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (cfg && cfg.host) {
    const fe = cfg.from_email || cfg.username
    return {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.username, pass: cfg.password },
      from: cfg.from_name ? `"${cfg.from_name}" <${fe}>` : fe,
    }
  }

  const user = Deno.env.get('SMTP_USER') ?? ''
  return {
    host: Deno.env.get('SMTP_HOST') ?? '',
    port: parseInt(Deno.env.get('SMTP_PORT') ?? '587'),
    secure: Deno.env.get('SMTP_PORT') === '465',
    auth: { user, pass: Deno.env.get('SMTP_PASS') ?? '' },
    from: `"CRM" <${user}>`,
  }
}

export async function sendMail(
  smtp: ResolvedSmtp,
  msg: { to: string; subject: string; html: string },
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  })
  await transporter.sendMail({ from: smtp.from, to: msg.to, subject: msg.subject, html: msg.html })
}

// Render one recipient's HTML body, honouring plain-text vs HTML drafts.
export function renderBody(body: string, isHtml: boolean, r: Recipient): string {
  const injected = injectVariables(body, r)
  return isHtml ? injected : injected.replace(/\n/g, '<br/>')
}
