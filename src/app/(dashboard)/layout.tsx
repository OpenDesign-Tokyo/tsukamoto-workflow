'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DemoAuthProvider } from '@/lib/auth/DemoAuthProvider'
import { useDemoAuth } from '@/lib/auth/demo-auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useDemoAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login')
    }
  }, [isLoading, currentUser, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DemoAuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </DemoAuthProvider>
  )
}
