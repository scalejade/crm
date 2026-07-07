// Worker invoked once a minute by pg_cron (see migration 002). It claims any
// draft whose scheduled_at has passed and sends it, using the SERVICE ROLE key
// (no user session exists for a scheduled job). Access is gated by a shared
// x-cron-secret header so it can't be triggered by the public.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { renderBody, resolveSmtp, sendMail, type Recipient, type ResolvedSmtp } from '../_shared/email.ts'

// Cap work per tick so a single invocation never approaches the edge runtime's
// wall-time limit. Frequent ticks drain any backlog.
const MAX_DRAFTS_PER_RUN = 25

Deno.serve(async (req: Request) => {
  // 1. Auth — cron only.
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 2. Find due drafts.
  const nowIso = new Date().toISOString()
  const { data: due, error: dueErr } = await supabase
    .schema('crm')
    .from('email_drafts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(MAX_DRAFTS_PER_RUN)

  if (dueErr) return json({ error: dueErr.message }, 500)
  if (!due || due.length === 0) return json({ processed: 0, sent: 0, failed: 0 })

  // 3. Claim atomically: flip scheduled → sending, guarding against a second
  //    overlapping tick grabbing the same rows.
  const ids = due.map((d: { id: string }) => d.id)
  const { data: claimed } = await supabase
    .schema('crm')
    .from('email_drafts')
    .update({ status: 'sending' })
    .in('id', ids)
    .eq('status', 'scheduled')
    .select('*')

  let sent = 0
  let failed = 0
  const smtpCache = new Map<string, ResolvedSmtp>()

  for (const draft of claimed ?? []) {
    try {
      let smtp = smtpCache.get(draft.user_id)
      if (!smtp) {
        smtp = await resolveSmtp(supabase, draft.user_id)
        smtpCache.set(draft.user_id, smtp)
      }

      const failedRecipients: Recipient[] = []
      for (const r of draft.recipients as Recipient[]) {
        try {
          await sendMail(smtp, {
            to: r.email,
            subject: renderBody(draft.subject, true, r), // subject: variables only, no <br/>
            html: renderBody(draft.body, draft.is_html, r),
          })
          sent++
          if (r.contact_id) {
            await supabase.schema('crm').from('contacts')
              .update({ last_contacted_at: new Date().toISOString() })
              .eq('id', r.contact_id)
          }
        } catch (e) {
          failed++
          failedRecipients.push(r)
          console.error(`send failed → ${r.email}:`, e)
        }
      }

      if (failedRecipients.length === 0) {
        // fully delivered — remove the draft (matches manual-send behaviour)
        await supabase.schema('crm').from('email_drafts').delete().eq('id', draft.id)
      } else {
        // keep only the recipients that failed so a reschedule won't double-send
        await supabase.schema('crm').from('email_drafts').update({
          status: 'failed',
          recipients: failedRecipients,
          last_error: `${failedRecipients.length} recipient(s) failed`,
        }).eq('id', draft.id)
      }
    } catch (e) {
      // whole-draft failure (e.g. SMTP unresolvable) — mark failed, keep it.
      await supabase.schema('crm').from('email_drafts')
        .update({ status: 'failed', last_error: String(e) })
        .eq('id', draft.id)
      console.error(`draft ${draft.id} failed:`, e)
    }
  }

  return json({ processed: claimed?.length ?? 0, sent, failed })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
