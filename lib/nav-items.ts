import {
  Users, Tag, Kanban, LayoutDashboard, Building2,
  HardDrive, FileCode2, Settings, FileText, Mail,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  key: string
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  // Tabs that can never be hidden (Settings — so users can always undo this).
  alwaysVisible?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'overview', href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { key: 'contacts', href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { key: 'companies', href: '/dashboard/companies', label: 'Companies', icon: Building2 },
  { key: 'pipeline', href: '/dashboard/pipeline', label: 'Pipeline', icon: Kanban },
  { key: 'tags', href: '/dashboard/tags', label: 'Tags', icon: Tag },
  { key: 'emails', href: '/dashboard/emails', label: 'Emails', icon: Mail },
  { key: 'templates', href: '/dashboard/templates', label: 'Templates', icon: FileCode2 },
  { key: 'markdown', href: '/dashboard/md', label: 'Markdown', icon: FileText },
  { key: 'storage', href: '/dashboard/storage', label: 'Storage', icon: HardDrive },
  { key: 'settings', href: '/dashboard/settings', label: 'Settings', icon: Settings, alwaysVisible: true },
]
