'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  CheckSquare,
  Archive,
  Building2,
  Users,
  Route,
  FileSpreadsheet,
  UserCheck,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const mainNav = [
  { label: 'ダッシュボード', href: '/', icon: LayoutDashboard },
  { label: '新規申請', href: '/applications/new', icon: FilePlus },
  { label: '申請一覧', href: '/applications', icon: FileText },
  { label: '承認待ち', href: '/approvals', icon: CheckSquare },
  { label: 'アーカイブ', href: '/archive', icon: Archive },
]

const adminNav = [
  { label: '組織図', href: '/admin/org', icon: Building2 },
  { label: 'ユーザー', href: '/admin/users', icon: Users },
  { label: '承認ルート', href: '/admin/routes', icon: Route },
  { label: 'フォーム', href: '/admin/forms', icon: FileSpreadsheet },
  { label: '代理承認', href: '/admin/proxy', icon: UserCheck },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { currentUser } = useCurrentUser()

  return (
    <>
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-bold">ツカモトワークフロー</h1>
        <p className="text-xs text-white/60 mt-1">承認管理システム</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {mainNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}

        {currentUser?.is_admin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">管理</p>
            </div>
            {adminNav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-[#1e3a5f] text-white shadow-lg"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-[#1e3a5f] text-white flex-col min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-[#1e3a5f] text-white flex flex-col min-h-screen">
            <button
              type="button"
              className="absolute top-3 right-3 p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <NavContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
