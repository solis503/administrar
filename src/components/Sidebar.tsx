'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useState } from 'react'

export default function Sidebar({ userName, businessName, userRole }: { userName: string; businessName: string; userRole: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/pos', label: 'Punto de Venta', icon: '🛒' },
    { href: '/products', label: 'Productos', icon: '📦' },
    { href: '/inventory', label: 'Inventario', icon: '🏷️' },
    { href: '/reports', label: 'Reportes', icon: '📈' },
    { href: '/suppliers', label: 'Proveedores', icon: '🚚' },
    { href: '/clients', label: 'Clientes', icon: '👥' },
    { href: '/expenses', label: 'Gastos', icon: '💸' },
    { href: '/settings', label: 'Configuración', icon: '⚙️' },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleBadge = {
    owner: { label: 'Propietario', color: 'bg-yellow-100 text-yellow-700' },
    manager: { label: 'Gerente', color: 'bg-blue-100 text-blue-700' },
    seller: { label: 'Vendedor', color: 'bg-green-100 text-green-700' },
  }[userRole] || { label: 'Sin rol', color: 'bg-gray-100 text-gray-700' }

  return (
    <>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-lg rounded-xl p-2">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">FlowStock Pro</h2>
              <p className="text-xs text-gray-500 truncate">{businessName}</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition text-left ${isActive ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600 truncate">{userName}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge.color}`}>{roleBadge.label}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition">
            <span className="text-lg">🚪</span>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  )
}
