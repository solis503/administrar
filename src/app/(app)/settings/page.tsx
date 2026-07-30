'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('$')
  const [tax, setTax] = useState('13')
  const [loyaltyRate, setLoyaltyRate] = useState('10')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'general' | 'employees' | 'branches' | 'loyalty'>('general')
  const [profiles, setProfiles] = useState<any[]>([])
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [empForm, setEmpForm] = useState({ email: '', name: '', role: 'seller' as 'owner' | 'manager' | 'seller', permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: false, expenses: false } })
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let b: any = null
    const { data: ob } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (ob) b = ob
    else { const { data: pr } = await supabase.from('profiles').select('*, businesses(*)').eq('user_id', user.id).single(); if (pr) b = pr.businesses }
    if (b) {
      setBusiness(b)
      setName(b.name)
      setCurrency(b.currency_symbol)
      setTax(String(b.tax_percentage))
      setLoyaltyRate(String(b.loyalty_points_rate || 10))
      const { data: profs } = await supabase.from('profiles').select('*').eq('business_id', b.id).order('created_at', { ascending: false })
      setProfiles(profs || [])
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!business) return
    await supabase.from('businesses').update({
      name, currency_symbol: currency,
      tax_percentage: parseFloat(tax) || 0,
      loyalty_points_rate: parseFloat(loyaltyRate) || 10,
    }).eq('id', business.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAddEmployee = async () => {
    if (!empForm.email || !business) return
    const { data: existingUser } = await supabase.from('profiles').select('user_id').eq('email', empForm.email).eq('business_id', business.id).single()
    if (existingUser) {
      alert('Este empleado ya existe')
      return
    }
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: empForm.email, password: tempPassword })
    if (authError && !authError.message.includes('already')) {
      alert('Error: ' + authError.message)
      return
    }
    const userId = authData.user?.id
    if (!userId) {
      const { data: existing } = await supabase.from('profiles').select('user_id').eq('email', empForm.email).eq('business_id', business.id).single()
      if (existing) {
        await supabase.from('profiles').update({ role: empForm.role, active: true, full_name: empForm.name }).eq('user_id', existing.user_id).eq('business_id', business.id)
        setShowAddEmployee(false)
        loadData()
        return
      }
      alert('No se pudo crear el usuario. Verifica el email.')
      return
    }
    await supabase.from('profiles').insert({
      user_id: userId,
      business_id: business.id,
      role: empForm.role,
      full_name: empForm.name,
      email: empForm.email,
      active: true,
    })
    setShowAddEmployee(false)
    setEmpForm({ email: '', name: '', role: 'seller', permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: false, expenses: false } })
    loadData()
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from('profiles').update({ active }).eq('id', id)
    loadData()
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Eliminar este empleado?')) return
    await supabase.from('profiles').delete().eq('id', id)
    loadData()
  }

  const openEditEmployee = (emp: any) => {
    setEditingEmployee(emp)
    setEmpForm({
      email: emp.email || '',
      name: emp.full_name || '',
      role: emp.role || 'seller',
      permissions: { dashboard: emp.role === 'owner' || emp.role === 'manager', pos: true, products: emp.role !== 'seller', inventory: emp.role !== 'seller', reports: emp.role !== 'seller', suppliers: emp.role !== 'seller', clients: true, expenses: emp.role !== 'seller' }
    })
    setShowAddEmployee(true)
  }

  const roleBadge: any = { owner: { l: 'Propietario', c: 'bg-yellow-100 text-yellow-700' }, manager: { l: 'Gerente', c: 'bg-blue-100 text-blue-700' }, seller: { l: 'Vendedor', c: 'bg-green-100 text-green-700' } }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuración</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {[['general', '🏢 General'], ['employees', '👥 Empleados'], ['branches', '📍 Sucursales'], ['loyalty', '⭐ Lealtad']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === v ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div><label className="text-sm font-medium block mb-1">Nombre del Negocio</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" /></div>
          <div><label className="text-sm font-medium block mb-1">Moneda</label><div className="flex gap-2 flex-wrap">{['$', '€', 'RD$', 'Q', 'L', 'S/', 'Bs', '₡', '£', '¥'].map(s => (<button key={s} onClick={() => setCurrency(s)} className={`px-4 py-2 rounded-xl border-2 font-semibold ${currency === s ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>{s}</button>))}</div></div>
          <div><label className="text-sm font-medium block mb-1">IVA (%)</label><div className="flex items-center gap-2"><input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} className="w-32 px-4 py-3 rounded-xl border outline-none" /><span className="font-semibold">%</span></div></div>
          <button onClick={handleSave} className="px-8 py-3 bg-primary-600 text-white font-bold rounded-xl">💾 Guardar {saved && '✓'}</button>
        </div>
      )}

      {tab === 'employees' && (
        <div>
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">👥 Gestión de Empleados</h2>
              <button onClick={() => { setEditingEmployee(null); setEmpForm({ email: '', name: '', role: 'seller', permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: false, expenses: false } }); setShowAddEmployee(true) }} className="bg-primary-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">+ Agregar Empleado</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Permisos por Rol</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3"><strong className="text-yellow-800">👑 Propietario</strong><p className="text-yellow-700 text-xs mt-1">Acceso total: Todo</p></div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3"><strong className="text-blue-800">🏢 Gerente</strong><p className="text-blue-700 text-xs mt-1">Dashboard, POS, Productos, Inventario, Reportes, Clientes</p></div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3"><strong className="text-green-800">🛒 Vendedor</strong><p className="text-green-700 text-xs mt-1">Solo Punto de Venta y Clientes</p></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-yellow-50/50 flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">👑</div>
              <div className="flex-1"><p className="font-semibold">Tú (Propietario)</p><p className="text-sm text-gray-500">Cuenta principal</p></div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">Propietario</span>
            </div>
            {profiles.filter(p => p.role !== 'owner').map((emp: any) => (
              <div key={emp.id} className="p-4 border-b flex items-center gap-4 hover:bg-gray-50">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">{(emp.full_name || emp.email || '?').charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="font-medium">{emp.full_name || 'Sin nombre'} {!emp.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2">Inactivo</span>}</p><p className="text-sm text-gray-500 truncate">{emp.email}</p></div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${roleBadge[emp.role]?.c || 'bg-gray-100'}`}>{roleBadge[emp.role]?.l || emp.role}</span>
                <button onClick={() => openEditEmployee(emp)} className="text-primary-600 text-sm font-medium hover:underline">Editar</button>
                <button onClick={() => handleToggleActive(emp.id, !emp.active)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.active ? 'Activo' : 'Inactivo'}</button>
                <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-600 text-sm">🗑️</button>
              </div>
            ))}
            {profiles.filter(p => p.role !== 'owner').length === 0 && <div className="p-8 text-center text-gray-400">No hay empleados aún. ¡Agrega el primero!</div>}
          </div>
        </div>
      )}

      {tab === 'branches' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">📍 Sucursales</h2>
          <div className="flex items-center gap-3 p-3 border rounded-xl bg-green-50"><span className="text-lg">📍</span><div className="flex-1"><p className="font-medium">Sucursal Principal</p></div><span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Activa</span></div>
        </div>
      )}

      {tab === 'loyalty' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold mb-2">⭐ Programa de Lealtad</h2>
          <div><label className="text-sm font-medium block mb-1">Puntos por cada</label><div className="flex items-center gap-2"><input type="number" value={loyaltyRate} onChange={e => setLoyaltyRate(e.target.value)} className="w-32 px-4 py-3 rounded-xl border outline-none" /><span className="text-gray-500">de compra = 1 punto</span></div></div>
          <button onClick={handleSave} className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl">💾 Guardar</button>
        </div>
      )}

      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">{editingEmployee ? '✏️ Editar Empleado' : '👤 Nuevo Empleado'}</h2><button onClick={() => setShowAddEmployee(false)} className="text-gray-400 text-2xl">✕</button></div>
            <div className="space-y-4">
              <div><label className="text-sm font-medium block mb-1">Nombre completo</label><input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Juan Pérez" /></div>
              <div><label className="text-sm font-medium block mb-1">Email *</label><input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} disabled={!!editingEmployee} className="w-full px-4 py-3 rounded-xl border outline-none disabled:bg-gray-50" placeholder="empleado@email.com" /></div>
              <div>
                <label className="text-sm font-medium block mb-2">Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['manager', 'seller'] as const).map(r => (
                    <button key={r} onClick={() => setEmpForm({ ...empForm, role: r })} className={`p-3 rounded-xl border-2 text-left ${empForm.role === r ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}>
                      <p className="font-semibold text-sm">{r === 'manager' ? '🏢 Gerente' : '🛒 Vendedor'}</p>
                      <p className="text-xs text-gray-500 mt-1">{r === 'manager' ? 'Dashboard, POS, productos, inventario' : 'Solo vender'}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">🔐 Permisos de acceso</h3>
                <div className="space-y-2">
                  {[
                    { key: 'dashboard', label: '📊 Dashboard', roles: ['manager'] },
                    { key: 'pos', label: '🛒 Punto de Venta', roles: ['manager', 'seller'] },
                    { key: 'products', label: '📦 Productos', roles: ['manager'] },
                    { key: 'inventory', label: '🏷️ Inventario', roles: ['manager'] },
                    { key: 'reports', label: '📈 Reportes', roles: ['manager'] },
                    { key: 'suppliers', label: '🚚 Proveedores', roles: ['manager'] },
                    { key: 'clients', label: '👥 Clientes', roles: ['manager', 'seller'] },
                    { key: 'expenses', label: '💸 Gastos', roles: ['manager'] },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <input type="checkbox" checked={(empForm.permissions as any)[key]} onChange={e => setEmpForm({ ...empForm, permissions: { ...empForm.permissions, [key]: e.target.checked } })} className="w-4 h-4 rounded text-primary-600" />
                      <label className="text-sm">{label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={editingEmployee ? () => { setShowAddEmployee(false) } : handleAddEmployee} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl">{editingEmployee ? '✓ Cerrar' : '✅ Agregar Empleado'}</button>
              <button onClick={() => setShowAddEmployee(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
            {!editingEmployee && <p className="text-xs text-gray-400 mt-3 text-center">Se enviará un email al empleado con su contraseña temporal</p>}
          </div>
        </div>
      )}
    </div>
  )
}
