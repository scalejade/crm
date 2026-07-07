'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { EmailDraft, ContactWithRelations, EmailTemplate } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Send, Loader2, Trash2, Eye, Code2, FileCode2, X,
  Plus, Users, Mail, ChevronDown, Upload, Pencil, Download, FileSpreadsheet, Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

type Recipient = { contact_id: string | null; email: string; full_name: string; company?: string }

const VARIABLES = ['{{full_name}}', '{{email}}', '{{company_name}}']

function injectVariables(template: string, r: Recipient): string {
  return template
    .replace(/\{\{full_name\}\}/g, r.full_name)
    .replace(/\{\{email\}\}/g, r.email)
    .replace(/\{\{company_name\}\}/g, '')
}

// ─── Import template ──────────────────────────────────────────────────────────
// Columns recognised by handleXlsxImport. Each row becomes its own draft (one
// email per recipient) with its own subject and message. `email` is required.
// {{name}} / {{company}} / {{email}} placeholders are filled in per row.
const TEMPLATE_COLS = ['name', 'company', 'email', 'subject', 'message'] as const
const TEMPLATE_ROWS = [
  {
    name: 'Jane Doe',
    company: 'Acme Inc',
    email: 'jane.doe@example.com',
    subject: 'Quick question, {{name}}',
    message: 'Hi {{name}},\n\nI wanted to reach out to {{company}} regarding...\n\nBest,\nYour Name',
  },
  {
    name: 'John Smith',
    company: 'Globex',
    email: 'john.smith@example.com',
    subject: 'Following up with {{company}}',
    message: 'Hi {{name}},\n\nJust circling back...\n\nBest,\nYour Name',
  },
]

function buildTemplateSheet() {
  return XLSX.utils.json_to_sheet(TEMPLATE_ROWS, { header: [...TEMPLATE_COLS] })
}

function downloadSheet(ws: XLSX.WorkSheet, filename: string, format: 'xlsx' | 'csv') {
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recipients')
    XLSX.writeFile(wb, `${filename}.xlsx`)
    return
  }
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadTemplate(format: 'xlsx' | 'csv') {
  downloadSheet(buildTemplateSheet(), 'email-import-template', format)
}

// Export drafts back into the same column schema as the import template — one
// row per recipient, body kept raw so it round-trips through the importer.
function downloadDrafts(
  drafts: EmailDraft[],
  companyByContactId: Map<string, string>,
  format: 'xlsx' | 'csv',
) {
  const rows = drafts.flatMap(d =>
    (d.recipients.length ? d.recipients : [{ contact_id: null, email: '', full_name: '' } as Recipient]).map(r => ({
      name: r.full_name,
      company: r.company || (r.contact_id ? companyByContactId.get(r.contact_id) ?? '' : ''),
      email: r.email,
      subject: d.subject,
      message: d.body,
    }))
  )
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_COLS] })
  downloadSheet(ws, 'email-drafts', format)
}

// ─── Contact picker modal ─────────────────────────────────────────────────────

function ContactPicker({ onAdd, onClose }: { onAdd: (r: Recipient[]) => void; onClose: () => void }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<ContactWithRelations[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.schema('crm')
      .from('contacts')
      .select('*, companies(*), contact_tags(*, tags(*))')
      .order('full_name')
      .then(({ data }) => { setContacts((data as ContactWithRelations[]) ?? []); setLoading(false) })
  }, [user])

  const filtered = contacts.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const handleAdd = () => {
    onAdd(contacts.filter(c => selected.has(c.id)).map(c => ({ contact_id: c.id, email: c.email, full_name: c.full_name, company: c.companies?.name ?? '' })))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="font-semibold text-zinc-100">Add contacts</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 border-b border-zinc-800">
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
          ) : filtered.map(c => (
            <button key={c.id} type="button" onClick={() => toggle(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left">
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected.has(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-600'}`}>
                {selected.has(c.id) && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{c.full_name}</p>
                <p className="text-xs text-zinc-500 truncate">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">{selected.size} selected</span>
          <Button onClick={handleAdd} disabled={selected.size === 0} size="sm">Add {selected.size || ''} contact{selected.size !== 1 ? 's' : ''}</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Compose panel ────────────────────────────────────────────────────────────

function ComposePanel({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isHtml, setIsHtml] = useState(false)
  const [preview, setPreview] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scheduleOn, setScheduleOn] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const xlsxInputRef = useRef<HTMLInputElement>(null)

  const handleXlsxImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

        if (rows.length === 0) { toast.error('The file is empty.'); return }

        const getCol = (row: Record<string, string>, ...keys: string[]) =>
          Object.entries(row).find(([k]) => keys.includes(k.trim().toLowerCase()))?.[1]?.toString().trim() ?? ''

        const fill = (text: string, vars: Record<string, string>) =>
          text
            .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
            .replace(/\{\{\s*full_name\s*\}\}/gi, vars.name)
            .replace(/\{\{\s*company(?:_name)?\s*\}\}/gi, vars.company)
            .replace(/\{\{\s*email\s*\}\}/gi, vars.email)

        // One draft per row — each email is inserted individually.
        const newDrafts: Array<{
          user_id: string; subject: string; body: string; is_html: boolean; recipients: Recipient[]
        }> = []
        const skipped: string[] = []

        for (const row of rows) {
          const email = getCol(row, 'email')
          const name = getCol(row, 'name', 'full_name') || email
          const company = getCol(row, 'company', 'company_name')
          const subject = getCol(row, 'subject')
          const message = getCol(row, 'message', 'body', 'content')

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (email) skipped.push(email)
            continue
          }

          const vars = { name, company, email }
          newDrafts.push({
            user_id: user.id,
            subject: fill(subject, vars),
            body: fill(message, vars),
            is_html: false,
            recipients: [{ contact_id: null, email, full_name: name, company }],
          })
        }

        if (newDrafts.length === 0) {
          toast.error('No valid emails found. Ensure your file has an "email" column.')
        } else {
          const { error } = await supabase.schema('crm').from('email_drafts').insert(newDrafts)
          if (error) {
            toast.error(error.message)
          } else {
            toast.success(
              skipped.length > 0
                ? `Created ${newDrafts.length} drafts, skipped ${skipped.length} invalid`
                : `Created ${newDrafts.length} draft${newDrafts.length !== 1 ? 's' : ''} — one per email`
            )
            onSaved()
          }
        }
      } catch {
        toast.error('Failed to parse file. Make sure it is a valid .xlsx or .csv file.')
      }
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  useEffect(() => {
    if (!user) return
    supabase.schema('crm').from('email_templates').select('*').order('name')
      .then(({ data }) => setTemplates(data ?? []))
  }, [user])

  const removeRecipient = (email: string) => setRecipients(prev => prev.filter(r => r.email !== email))

  const addRecipients = (incoming: Recipient[]) => {
    setRecipients(prev => {
      const existing = new Set(prev.map(r => r.email))
      return [...prev, ...incoming.filter(r => !existing.has(r.email))]
    })
  }

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and body are required'); return }
    if (recipients.length === 0) { toast.error('Add at least one recipient'); return }
    if (!user) return

    let schedule: { status: 'scheduled'; scheduled_at: string } | null = null
    if (scheduleOn) {
      if (!scheduledAt) { toast.error('Pick a date & time to schedule'); return }
      const when = new Date(scheduledAt)
      if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        toast.error('Scheduled time must be in the future'); return
      }
      schedule = { status: 'scheduled', scheduled_at: when.toISOString() }
    }

    setSaving(true)
    const { error } = await supabase.schema('crm').from('email_drafts').insert({
      user_id: user.id, subject: subject.trim(), body, is_html: isHtml, recipients, ...(schedule ?? {}),
    })
    if (error) toast.error(error.message)
    else {
      toast.success(schedule ? `Scheduled for ${format(new Date(schedule.scheduled_at), 'MMM d, h:mm a')}` : 'Draft saved')
      setSubject(''); setBody(''); setRecipients([]); setIsHtml(false); setPreview(false)
      setScheduleOn(false); setScheduledAt(''); setOpen(false)
      onSaved()
    }
    setSaving(false)
  }

  const closeModal = () => { setOpen(false); setShowTemplatePicker(false); setShowTemplateMenu(false); setPreview(false) }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Plus className="w-4 h-4" /> Compose new draft
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" /> Compose new draft
              </h3>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Recipients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Recipients</Label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add from contacts
                </button>
                <button type="button" onClick={() => xlsxInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Import XLSX / CSV
                </button>
                <div className="relative">
                  <button type="button" onClick={() => setShowTemplateMenu(p => !p)}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Template
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showTemplateMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowTemplateMenu(false)} />
                      <div className="absolute right-0 mt-1 z-20 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                        <button type="button"
                          onClick={() => { downloadTemplate('xlsx'); setShowTemplateMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Download .xlsx
                        </button>
                        <button type="button"
                          onClick={() => { downloadTemplate('csv'); setShowTemplateMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" /> Download .csv
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleXlsxImport}
                />
              </div>
            </div>
            {recipients.length === 0
              ? <p className="text-xs text-zinc-600 italic">
                  No recipients yet — add from contacts, or import an XLSX / CSV with columns{' '}
                  <span className="font-mono text-zinc-500">name, company, email, subject, message</span>.
                  Each row becomes its own draft (download the template above).
                </p>
              : <div className="flex flex-wrap gap-1.5">
                  {recipients.map(r => (
                    <span key={r.email} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-1 text-xs text-zinc-300">
                      {r.full_name}
                      <button onClick={() => removeRecipient(r.email)} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
            }
          </div>

          {/* Template picker */}
          <div>
            <button type="button" onClick={() => setShowTemplatePicker(p => !p)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
              <FileCode2 className="w-3.5 h-3.5" />{showTemplatePicker ? 'Hide templates' : 'Use a template'}
            </button>
            {showTemplatePicker && (
              <div className="mt-2 border border-zinc-700 rounded-lg overflow-hidden">
                {templates.length === 0
                  ? <p className="text-xs text-zinc-500 px-3 py-2">No templates yet.</p>
                  : templates.map(t => (
                      <button key={t.id} type="button" onClick={() => { setBody(t.html_content); if (t.subject) setSubject(t.subject); setIsHtml(true); setShowTemplatePicker(false) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0">
                        <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200 font-medium truncate">{t.name}</p>
                          {t.subject && <p className="text-xs text-zinc-500 truncate">{t.subject}</p>}
                        </div>
                      </button>
                    ))
                }
              </div>
            )}
          </div>

          {!isHtml && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Insert variable:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <button key={v} type="button" onClick={() => setBody(prev => prev + v)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-indigo-400 rounded-md px-2 py-1 font-mono transition-colors">{v}</button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{isHtml ? 'Body (HTML)' : 'Body'}</Label>
              <button type="button" onClick={() => setPreview(p => !p)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                {preview ? <><Code2 className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
              </button>
            </div>
            {preview
              ? isHtml
                ? <iframe srcDoc={body} sandbox="allow-same-origin" title="Preview" className="w-full h-64 rounded-lg border border-zinc-700 bg-white" />
                : <div className="min-h-[160px] rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 whitespace-pre-wrap">{body || <span className="text-zinc-600 italic">Nothing to preview</span>}</div>
              : isHtml
                ? <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
                : <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder={`Dear {{full_name}},\n\n...`} rows={6} />
            }
          </div>

              {/* Schedule send */}
              <div className="space-y-2 border-t border-zinc-800 pt-4">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
                  <input type="checkbox" checked={scheduleOn} onChange={e => setScheduleOn(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 accent-indigo-600" />
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Schedule send for later
                </label>
                {scheduleOn && (
                  <div className="pl-6 space-y-1">
                    <Input type="datetime-local" value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} />
                    <p className="text-xs text-zinc-500">Uses your local time. The email is sent automatically at this time.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800 shrink-0">
              <Button variant="ghost" size="sm" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : scheduleOn ? <Clock className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {scheduleOn ? 'Schedule' : 'Save to Drafts'}
              </Button>
            </div>
          </div>
          {showPicker && <ContactPicker onAdd={addRecipients} onClose={() => setShowPicker(false)} />}
        </div>
      )}
    </>
  )
}

// ─── Send a single draft to all its recipients ────────────────────────────────

async function sendDraft(draft: EmailDraft): Promise<{ ok: number; fail: number }> {
  let ok = 0; let fail = 0
  for (const recipient of draft.recipients) {
    const htmlContent = draft.is_html
      ? injectVariables(draft.body, recipient)
      : injectVariables(draft.body, recipient).replace(/\n/g, '<br/>')
    const { error } = await supabase.functions.invoke('send-custom-email', {
      body: { to: recipient.email, subject: injectVariables(draft.subject, recipient), htmlContent },
    })
    if (error) { fail++; console.error(error) }
    else {
      ok++
      if (recipient.contact_id) {
        await supabase.schema('crm').from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', recipient.contact_id)
      }
    }
  }
  return { ok, fail }
}

// ─── Draft preview / edit sidebar ─────────────────────────────────────────────

function DraftPreview({ draft, startInEdit = false, onClose, onChanged }: {
  draft: EmailDraft
  startInEdit?: boolean
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(startInEdit)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable copy — also drives the read-only preview so saved edits show immediately.
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [isHtml, setIsHtml] = useState(draft.is_html)
  const [recipients, setRecipients] = useState<Recipient[]>(draft.recipients)
  const [showPicker, setShowPicker] = useState(false)

  const removeRecipient = (email: string) => setRecipients(prev => prev.filter(r => r.email !== email))
  const addRecipients = (incoming: Recipient[]) => setRecipients(prev => {
    const existing = new Set(prev.map(r => r.email))
    return [...prev, ...incoming.filter(r => !existing.has(r.email))]
  })

  const resetEdits = () => {
    setSubject(draft.subject); setBody(draft.body); setIsHtml(draft.is_html); setRecipients(draft.recipients)
  }

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and body are required'); return }
    if (recipients.length === 0) { toast.error('Add at least one recipient'); return }
    if (!user) return
    setSaving(true)
    const { error } = await supabase.schema('crm').from('email_drafts').update({
      subject: subject.trim(), body, is_html: isHtml, recipients,
    }).eq('id', draft.id)
    if (error) toast.error(error.message)
    else { toast.success('Draft updated'); onChanged(); setEditing(false) }
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.schema('crm').from('email_drafts').delete().eq('id', draft.id)
    if (error) { toast.error(error.message); setDeleting(false); return }
    toast.success('Draft deleted')
    await onChanged(); onClose()
  }

  const handleSend = async () => {
    setSending(true)
    const { ok, fail } = await sendDraft({ ...draft, subject, body, is_html: isHtml, recipients })
    if (fail === 0) {
      // all delivered — remove the draft and refresh, then close
      await supabase.schema('crm').from('email_drafts').delete().eq('id', draft.id)
      toast.success(`Sent ${ok} email${ok !== 1 ? 's' : ''}`)
      await onChanged(); onClose()
    } else {
      // keep the draft so the failure can be retried
      toast.error(`Sent ${ok}, failed ${fail} — draft kept`)
      setSending(false)
    }
  }

  const busy = sending || deleting || saving
  const sample = recipients[0] ?? { contact_id: null, email: '', full_name: '' }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border-l border-zinc-800 w-full md:w-[45vw] md:max-w-none h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-800">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-100 truncate flex items-center gap-2">
              {editing && <Pencil className="w-4 h-4 text-indigo-400 shrink-0" />}
              {subject || '(no subject)'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 mt-0.5"><X className="w-4 h-4" /></button>
        </div>

        {editing ? (
          /* ── Edit mode ── */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Recipients</Label>
                <button type="button" onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add from contacts
                </button>
              </div>
              {recipients.length === 0
                ? <p className="text-xs text-zinc-600 italic">No recipients yet</p>
                : <div className="flex flex-wrap gap-1.5">
                    {recipients.map(r => (
                      <span key={r.email} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-1 text-xs text-zinc-300">
                        {r.full_name}
                        <button onClick={() => removeRecipient(r.email)} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
              }
            </div>

            {!isHtml && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Insert variable:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map(v => (
                    <button key={v} type="button" onClick={() => setBody(prev => prev + v)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-indigo-400 rounded-md px-2 py-1 font-mono transition-colors">{v}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{isHtml ? 'Body (HTML)' : 'Body'}</Label>
                <button type="button" onClick={() => setIsHtml(p => !p)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  <FileCode2 className="w-3.5 h-3.5" />{isHtml ? 'Plain text' : 'HTML'}
                </button>
              </div>
              {isHtml
                ? <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
                : <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder={`Dear {{full_name}},\n\n...`} rows={8} />
              }
            </div>
          </div>
        ) : (
          /* ── Read-only preview ── */
          <>
            <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap gap-1.5">
              {recipients.map(r => (
                <span key={r.email} className="text-xs bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-1 text-zinc-300">
                  {r.full_name} &lt;{r.email}&gt;
                </span>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col">
              {isHtml
                ? <iframe srcDoc={injectVariables(body, sample)} sandbox="allow-same-origin" title="Preview" className="w-full flex-1 min-h-64 rounded-lg border border-zinc-700 bg-white" />
                : <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-300 whitespace-pre-wrap">{body}</div>
              }
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => { resetEdits(); setEditing(false) }} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={busy} className="ml-auto">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDelete} disabled={busy}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
              </Button>
              <Button size="sm" onClick={handleSend} disabled={busy} className="ml-auto">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </>
          )}
        </div>
      </div>
      {showPicker && <ContactPicker onAdd={addRecipients} onClose={() => setShowPicker(false)} />}
    </div>
  )
}

// ─── Bulk schedule modal ──────────────────────────────────────────────────────

function BulkScheduleModal({ count, busy, onConfirm, onClose }: {
  count: number
  busy: boolean
  onConfirm: (iso: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const min = new Date(Date.now() + 60_000).toISOString().slice(0, 16)

  const submit = () => {
    if (!value) { toast.error('Pick a date & time'); return }
    const when = new Date(value)
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) { toast.error('Time must be in the future'); return }
    onConfirm(when.toISOString())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Schedule {count} draft{count !== 1 ? 's' : ''}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-4 space-y-2">
          <Label>Send date &amp; time</Label>
          <Input type="datetime-local" value={value} min={min} onChange={e => setValue(e.target.value)} autoFocus />
          <p className="text-xs text-zinc-500">
            All {count} selected draft{count !== 1 ? 's' : ''} will be sent automatically at this time (your local time).
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Schedule
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState<EmailDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [preview, setPreview] = useState<EmailDraft | null>(null)
  const [previewEdit, setPreviewEdit] = useState(false)
  const [sendProgress, setSendProgress] = useState<{ total: number; done: number; ok: number; fail: number } | null>(null)
  const [sendErrors, setSendErrors] = useState<string[]>([])
  const [sendMenuOpen, setSendMenuOpen] = useState(false)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'drafts' | 'scheduled'>('drafts')
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [selectMenuOpen, setSelectMenuOpen] = useState(false)

  const fetchDrafts = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.schema('crm')
      .from('email_drafts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setDrafts((data as EmailDraft[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // Split into the two tabs. Scheduled = waiting to auto-send; everything else
  // (draft / failed) lives in the Drafts tab.
  const scheduledDrafts = drafts.filter(d => d.status === 'scheduled')
  const inboxDrafts = drafts.filter(d => d.status !== 'scheduled')
  const visible = activeTab === 'scheduled' ? scheduledDrafts : inboxDrafts

  const switchTab = (tab: 'drafts' | 'scheduled') => { setActiveTab(tab); setSelected(new Set()) }

  const toggleAll = () => setSelected(prev =>
    visible.every(d => prev.has(d.id)) && prev.size > 0 ? new Set() : new Set(visible.map(d => d.id)))

  // Select the first N drafts in the current tab (for quick bulk schedule/send).
  const selectTop = (n: number) => { setSelected(new Set(visible.slice(0, n).map(d => d.id))); setSelectMenuOpen(false) }

  const handleDelete = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    const ids = [...selected]
    const { error } = await supabase.schema('crm').from('email_drafts').delete().in('id', ids)
    if (error) toast.error(error.message)
    else { toast.success(`Deleted ${ids.length} draft${ids.length !== 1 ? 's' : ''}`); setSelected(new Set()); fetchDrafts() }
    setDeleting(false)
  }

  // Send a batch of drafts. Tracks live progress; fully-sent drafts are deleted,
  // drafts with any failure are kept (trimmed to just the failed recipients) so a
  // retry never re-sends to addresses that already succeeded.
  const runSend = async (toSend: EmailDraft[]) => {
    if (toSend.length === 0 || sending) return
    const total = toSend.reduce((n, d) => n + d.recipients.length, 0)
    if (total === 0) return

    setSendMenuOpen(false)
    setSending(true)
    setSendErrors([])
    setSendProgress({ total, done: 0, ok: 0, fail: 0 })

    let done = 0; let ok = 0; let fail = 0
    const errors: string[] = []

    for (const draft of toSend) {
      const failedRecipients: Recipient[] = []
      for (const recipient of draft.recipients) {
        const htmlContent = draft.is_html
          ? injectVariables(draft.body, recipient)
          : injectVariables(draft.body, recipient).replace(/\n/g, '<br/>')
        const { error } = await supabase.functions.invoke('send-custom-email', {
          body: { to: recipient.email, subject: injectVariables(draft.subject, recipient), htmlContent },
        })
        done++
        if (error) {
          fail++; failedRecipients.push(recipient)
          errors.push(`${draft.subject || '(no subject)'} → ${recipient.email}: ${error.message}`)
          console.error(error)
        } else {
          ok++
          if (recipient.contact_id) {
            await supabase.schema('crm').from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', recipient.contact_id)
          }
        }
        setSendProgress({ total, done, ok, fail })
      }

      if (failedRecipients.length === 0) {
        await supabase.schema('crm').from('email_drafts').delete().eq('id', draft.id)
      } else if (failedRecipients.length < draft.recipients.length) {
        // partial success — keep draft but only with the recipients that failed
        await supabase.schema('crm').from('email_drafts').update({ recipients: failedRecipients }).eq('id', draft.id)
      }
    }

    if (fail === 0) toast.success(`Sent ${ok} email${ok !== 1 ? 's' : ''}`)
    else toast.error(`Sent ${ok}, failed ${fail} — failed drafts were kept`)

    setSendErrors(errors)
    setSelected(new Set())
    await fetchDrafts()   // refresh list so sent (deleted) drafts disappear before we stop
    setSending(false)
  }

  const handleSendSelected = () => runSend(drafts.filter(d => selected.has(d.id)))
  const handleSendTop = (n: number) => runSend(visible.slice(0, n))

  // Bulk-schedule every selected draft to auto-send at the same time.
  const handleScheduleSelected = async (iso: string) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setScheduling(true)
    const { error } = await supabase.schema('crm').from('email_drafts')
      .update({ status: 'scheduled', scheduled_at: iso, last_error: null }).in('id', ids)
    if (error) toast.error(error.message)
    else {
      toast.success(`Scheduled ${ids.length} draft${ids.length !== 1 ? 's' : ''} for ${format(new Date(iso), 'MMM d, h:mm a')}`)
      setSelected(new Set()); setScheduleModalOpen(false); setActiveTab('scheduled'); fetchDrafts()
    }
    setScheduling(false)
  }

  // Move selected scheduled drafts back to plain drafts.
  const handleUnscheduleSelected = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    setScheduling(true)
    const { error } = await supabase.schema('crm').from('email_drafts')
      .update({ status: 'draft', scheduled_at: null }).in('id', ids)
    if (error) toast.error(error.message)
    else { toast.success(`Unscheduled ${ids.length} draft${ids.length !== 1 ? 's' : ''}`); setSelected(new Set()); fetchDrafts() }
    setScheduling(false)
  }

  // Resolve company names from the CRM (contact_id → company.name) so the export
  // fills the `company` column for recipients that came from contacts.
  const handleExport = async (format: 'xlsx' | 'csv') => {
    setDownloadMenuOpen(false)
    const toExport = someSelected ? drafts.filter(d => selected.has(d.id)) : visible
    // Only look up older drafts whose recipients predate the stored `company` field.
    const ids = [...new Set(toExport.flatMap(d =>
      d.recipients.filter(r => r.contact_id && !r.company).map(r => r.contact_id as string)
    ))]
    const companyByContactId = new Map<string, string>()
    if (ids.length > 0) {
      const { data } = await supabase.schema('crm')
        .from('contacts').select('id, companies(name)').in('id', ids)
      for (const c of (data ?? []) as Array<{ id: string; companies: { name: string } | { name: string }[] | null }>) {
        const company = Array.isArray(c.companies) ? c.companies[0] : c.companies
        if (company?.name) companyByContactId.set(c.id, company.name)
      }
    }
    downloadDrafts(toExport, companyByContactId, format)
  }

  const allSelected = visible.length > 0 && visible.every(d => selected.has(d.id))
  const someSelected = selected.size > 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Emails</h1>
        <p className="text-zinc-400 text-sm mt-1">Compose drafts and send bulk emails to your contacts</p>
      </div>

      <ComposePanel onSaved={fetchDrafts} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {([
          { key: 'drafts' as const, label: 'Drafts', count: inboxDrafts.length, icon: Mail },
          { key: 'scheduled' as const, label: 'Scheduled', count: scheduledDrafts.length, icon: Clock },
        ]).map(({ key, label, count, icon: Icon }) => (
          <button key={key} type="button" onClick={() => switchTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-indigo-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            <Icon className="w-4 h-4" /> {label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 ${activeTab === key ? 'bg-indigo-600/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {/* Select all toggle */}
            <button type="button" onClick={toggleAll} disabled={visible.length === 0}
              className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors disabled:opacity-30
                         border-zinc-600 hover:border-indigo-500"
              style={{ background: allSelected ? '#4f46e5' : someSelected ? '#312e81' : 'transparent', borderColor: allSelected || someSelected ? '#4f46e5' : undefined }}>
              {allSelected
                ? <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : someSelected
                  ? <div className="w-2 h-0.5 bg-indigo-300 rounded" />
                  : null}
            </button>
            <span className="text-sm font-semibold text-zinc-300">
              {activeTab === 'scheduled' ? 'Scheduled' : 'Drafts'} {visible.length > 0 && <span className="text-zinc-500 font-normal">({visible.length})</span>}
            </span>

            {/* Select top N */}
            {visible.length > 1 && (
              <div className="relative">
                <button type="button" onClick={() => setSelectMenuOpen(o => !o)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  Select top <ChevronDown className="w-3 h-3" />
                </button>
                {selectMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSelectMenuOpen(false)} />
                    <div className="absolute left-0 mt-1 z-20 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
                      {[5, 10, 50, 100].filter(n => n < visible.length).map(n => (
                        <button key={n} type="button" onClick={() => selectTop(n)}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                          Top {n}
                        </button>
                      ))}
                      <button type="button" onClick={() => selectTop(visible.length)}
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        All {visible.length}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {someSelected && <span className="text-xs text-zinc-500">{selected.size} selected</span>}
          </div>

          <div className="flex items-center gap-2">
            {someSelected && (
              <>
                <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting || sending}
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/30">
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete
                </Button>
                {activeTab === 'scheduled' ? (
                  <Button size="sm" variant="ghost" onClick={handleUnscheduleSelected} disabled={scheduling || sending}>
                    {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Unschedule
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setScheduleModalOpen(true)} disabled={scheduling || sending}>
                    <Clock className="h-3.5 w-3.5" /> Schedule {selected.size}
                  </Button>
                )}
                <Button size="sm" onClick={handleSendSelected} disabled={sending}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? 'Sending...' : `Send ${selected.size}`}
                </Button>
              </>
            )}

            {/* Download drafts as template */}
            {visible.length > 0 && (
              <div className="relative">
                <Button size="sm" variant="ghost" onClick={() => setDownloadMenuOpen(o => !o)}>
                  <Download className="h-3.5 w-3.5" /> {someSelected ? `Export ${selected.size}` : 'Export'} <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                {downloadMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDownloadMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 z-20 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                      <button type="button"
                        onClick={() => handleExport('xlsx')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Download .xlsx
                      </button>
                      <button type="button"
                        onClick={() => handleExport('csv')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors border-t border-zinc-800">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" /> Download .csv
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Send top N */}
            {activeTab === 'drafts' && visible.length > 0 && (
              <div className="relative">
                <Button size="sm" variant={someSelected ? 'ghost' : 'default'} onClick={() => setSendMenuOpen(o => !o)} disabled={sending}>
                  <Send className="h-3.5 w-3.5" /> Send top <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                {sendMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSendMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 z-20 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
                      {[5, 10, 50].filter(n => n < visible.length).map(n => (
                        <button key={n} type="button" onClick={() => handleSendTop(n)}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                          Top {n} drafts
                        </button>
                      ))}
                      <button type="button" onClick={() => handleSendTop(visible.length)}
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                        All {visible.length} draft{visible.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Send progress */}
        {sendProgress && (
          <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                {sending && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
                {sending ? 'Sending…' : 'Done'} {sendProgress.done}/{sendProgress.total}
              </span>
              <span className="text-zinc-500">
                <span className="text-emerald-400">{sendProgress.ok} sent</span>
                {sendProgress.fail > 0 && <span className="text-red-400"> · {sendProgress.fail} failed</span>}
                {' · '}{Math.round((sendProgress.done / sendProgress.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(sendProgress.done / sendProgress.total) * 100}%` }} />
            </div>
            {!sending && (
              <button type="button" onClick={() => { setSendProgress(null); setSendErrors([]) }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Dismiss</button>
            )}
          </div>
        )}

        {/* Send errors — failed drafts were kept */}
        {sendErrors.length > 0 && (
          <div className="px-4 py-3 border-b border-zinc-800 bg-red-950/20">
            <p className="text-xs font-medium text-red-400 mb-1.5 flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> {sendErrors.length} failed — kept as draft{sendErrors.length !== 1 ? 's' : ''}
            </p>
            <ul className="space-y-1 max-h-32 overflow-auto">
              {sendErrors.map((e, i) => (
                <li key={i} className="text-xs text-red-300/80 break-words">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Header row */}
        {visible.length > 0 && (
          <div className="grid grid-cols-[2.5rem_1fr_6rem_5rem_2.5rem] px-4 py-2 border-b border-zinc-800 text-xs text-zinc-500 font-medium">
            <div />
            <div>Subject / Recipients</div>
            <div className="text-center">Recipients</div>
            <div className="text-right">{activeTab === 'scheduled' ? 'Send at' : 'Date'}</div>
            <div />
          </div>
        )}

        {/* Rows */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {activeTab === 'scheduled' ? <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" /> : <Mail className="w-8 h-8 mx-auto mb-3 opacity-30" />}
            <p className="text-sm">{activeTab === 'scheduled' ? 'No scheduled emails' : 'No drafts yet'}</p>
            <p className="text-xs mt-1">
              {activeTab === 'scheduled'
                ? 'Select drafts and click Schedule to queue them for automatic sending'
                : 'Compose one above or save a draft from a contact’s email composer'}
            </p>
          </div>
        ) : (
          visible.map(draft => {
            const isSelected = selected.has(draft.id)
            return (
              <div key={draft.id}
                className={`grid grid-cols-[2.5rem_1fr_6rem_5rem_2.5rem] items-center px-4 py-3 border-b border-zinc-800 last:border-0 transition-colors
                  ${isSelected ? 'bg-indigo-950/30' : 'hover:bg-zinc-800/40'}`}>
                {/* Toggle */}
                <div className="flex items-center">
                  <button type="button" onClick={() => toggleSelect(draft.id)}
                    className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: isSelected ? '#4f46e5' : 'transparent',
                      borderColor: isSelected ? '#4f46e5' : '#52525b',
                    }}>
                    {isSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                </div>

                {/* Subject + recipient names */}
                <button type="button" onClick={() => { setPreview(draft); setPreviewEdit(false) }} className="text-left min-w-0 pr-4">
                  <p className="text-sm font-medium text-zinc-200 truncate flex items-center gap-2">
                    <span className="truncate">{draft.subject || <span className="italic text-zinc-500">(no subject)</span>}</span>
                    {draft.status === 'scheduled' && draft.scheduled_at && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-900 rounded-full px-1.5 py-0.5">
                        <Clock className="w-2.5 h-2.5" />{format(new Date(draft.scheduled_at), 'MMM d, h:mm a')}
                      </span>
                    )}
                    {draft.status === 'failed' && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium bg-red-950/60 text-red-300 border border-red-900 rounded-full px-1.5 py-0.5">
                        <X className="w-2.5 h-2.5" />failed
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {draft.recipients.map(r => r.full_name).join(', ')}
                  </p>
                </button>

                {/* Recipients count */}
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <Users className="w-3 h-3" />{draft.recipients.length}
                  </span>
                </div>

                {/* Date */}
                <div className="text-right text-xs text-zinc-500">
                  {activeTab === 'scheduled' && draft.scheduled_at
                    ? format(new Date(draft.scheduled_at), 'MMM d, HH:mm')
                    : format(new Date(draft.created_at), 'MMM d')}
                </div>

                {/* Edit */}
                <div className="flex justify-end">
                  <button type="button" onClick={e => { e.stopPropagation(); setPreview(draft); setPreviewEdit(true) }}
                    className="text-zinc-500 hover:text-indigo-400 transition-colors p-1 rounded">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {preview && (
        <DraftPreview
          key={preview.id}
          draft={preview}
          startInEdit={previewEdit}
          onClose={() => setPreview(null)}
          onChanged={fetchDrafts}
        />
      )}

      {scheduleModalOpen && (
        <BulkScheduleModal
          count={selected.size}
          busy={scheduling}
          onConfirm={handleScheduleSelected}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}
    </div>
  )
}
