'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useState, useEffect } from 'react'

export default function Sidebar({ userName, businessName, userRole }: { userName: string; businessName: string; userRole: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [permissions, setPermissions] = useState<any>(null)
  const [debug, setDebug] = useState<string[]>([])

  useEffect(() => { 
    loadPermissions() 
  }, [])

  const addDebug = (msg: string) => {
    setDebug(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const loadPermissions = async () => {
    setDebug([])
    addDebug('Iniciando carga de permisos...')
    
    if (userRole === 'owner') {
      addDebug('✅ Rol: owner - Todos los permisos')
      setPermissions({
        dashboard: true, pos: true, products: true, inventory: true,
        reports: true, suppliers: true, clients: true, expenses: true, settings: true
      })
      return
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      addDebug('❌ Error: No hay usuario')
      return
    }
    
    addDebug(`Usuario: ${user.email} (${user.id})`)

    // Cargar TODOS los perfiles (no solo uno)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)

    if (error) {
      addDebug(`Error SQL: ${error.message}`)
      return
    }

    if (!profiles || profiles.length === 0) {
      addDebug('No hay perfiles activos')
      addDebug('Usando permisos por defecto')
      setPermissions({
        dashboard: false, pos: true, products: false, inventory: false,
        reports: false, suppliers: false, clients: false, expenses: false, settings: false
      })
      return
    }

    addDebug(`Encontrados ${profiles.length} perfil(es)`)

    // Usar el primer perfil con permisos
    let selectedProfile = null
    for (const profile of profiles) {
      addDebug(`Perfil: ${profile.full_name || 'Sin nombre'} - ${profile.role}`)
      
      if (profile.permissions && Object.keys(profile.permissions).length > 0) {
        addDebug('✅ Permisos encontrados:')
        addDebug(JSON.stringify(profile.permissions))
        selectedProfile = profile
        break
      }
    }

    if (selectedProfile && selectedProfile.permissions) {
      addDebug('✅ Aplicando permisos personalizados')
      setPermissions({
        ...selectedProfile.permissions,
        settings: selectedProfile.role === 'owner'
      })
    } else {
      addDebug('⚠️ Sin permisos personalizados')
      addDebug('Usando permisos por defecto según rol')
      
      if (userRole === 'manager') {
        setPermissions({
          dashboard: true, pos: true, products: true, inventory: true,
          reports: true, suppliers: true, clients: true, expenses: true, settings: false
        })
      } else {
        setPermissions({
          dashboard: false, pos: true, products: false, inventory: false,
          reports: false, suppliers: false, clients: false, expenses: false, settings: false
        })
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!permissions) {
    return (
      <aside className="fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-2">⏳</div>
          <p className="text-sm text-gray-500">Cargando...</p>
          {debug.length > 0 && (
            <div className="mt-4 bg-gray-900 text-green-400 rounded-lg p-2 font-mono text-xs text-left max-w-xs">
              {debug.map((d, i) => <div key={i}>{d}</div>)}
            </div>
          )}
        </div>
      </aside>
    )
  }

  const navItems = [
    permissions.dashboard && { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    permissions.pos && { href: '/pos', label: 'Punto de Venta', icon: '🛒' },
    permissions.products && { href: '/products', label: 'Productos', icon: '📦' },
    permissions.inventory && { href: '/inventory', label: 'Inventario', icon: '🏷️' },
    permissions.reports && { href: '/reports', label: 'Reportes', icon: '📈' },
    permissions.suppliers && { href: '/suppliers', label: 'Proveedores', icon: '🚚' },
    permissions.clients && { href: '/clients', label: 'Clientes', icon: '👥' },
    permissions.expenses && { href: '/expenses', label: 'Gastos', icon: '💸' },
    permissions.settings && { href: '/settings', label: 'Configuración', icon: '⚙️' },
  ].filter(Boolean) as { href: string; label: string; icon: string }[]

  const roleBadge: any = { 
    owner: { l: 'Propietario', c: 'bg-yellow-100 text-yellow-700' }, 
    manager: { l: 'Gerente', c: 'bg-blue-100 text-blue-700' }, 
    seller: { l: 'Vendedor', c: 'bg-green-100 text-green-700' } 
  }[userRole] || { l: userRole, c: 'bg-gray-100 text-gray-700' }

  return (
    <>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-lg rounded-xl p-2">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-gray-100">
          <Link href={navItems[0]?.href || '/pos'} className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">FlowStock Pro</h2>
              <p className="text-xs text-gray-500 truncate">{businessName}</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition text-left ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span className="text-lg">{item.icon}</span><span>{item.label}</span>
              </Link>
            )
          })}
          
          {debug.length > 0 && (
            <div className="mt-4 bg-gray-900 text-green-400 rounded-lg p-2 font-mono text-xs">
              <div className="text-yellow-400 font-bold mb-1">Debug:</div>
              {debug.map((d, i) => <div key={i}>{d}</div>)}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={loadPermissions} className="w-full mb-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 font-semibold">
            🔄 Refrescar
          </button>
          <div className="flex items-center gap-2 px-2 py-1 mb-1">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"><span className="text-xs font-medium">{userName.charAt(0).toUpperCase()}</span></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 truncate">{userName}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadge.c}`}>{roleBadge.l}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition text-sm"><span>🚪</span><span>Cerrar Sesión</span></button>
        </div>
      </aside>
    </>
  )
}
