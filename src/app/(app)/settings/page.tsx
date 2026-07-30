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
  const [tab, setTab] = useState('general')
  const [profiles, setProfiles] = useState<any[]>([])
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [empForm, setEmpForm] = useState({
    email: '', name: '', password: '', role: 'seller',
    permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: true, expenses: false }
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const addLog = (log: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${log}`])
  }

  const showMessage = (text: string, type: string) => {
    setMessage({ text, type })
    addLog(`Mensaje: ${text}`)
    setTimeout(() => setMessage({ text: '', type: '' }), 5000)
  }

  const loadData = async () => {
    setLoading(true)
    addLog('Cargando datos...')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { 
      addLog('No hay usuario')
      setLoading(false)
      return 
    }
    addLog(`Usuario: ${user.email}`)

    const { data: ownerBiz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()

    if (ownerBiz) {
      addLog(`Negocio encontrado: ${ownerBiz.name}`)
      setBusiness(ownerBiz)
      setName(ownerBiz.name)
      setCurrency(ownerBiz.currency_symbol)
      setTax(String(ownerBiz.tax_percentage))
      setLoyaltyRate(String(ownerBiz.loyalty_points_rate || 10))
      const { data: profs } = await supabase.from('profiles').select('*').eq('business_id', ownerBiz.id).order('created_at', { ascending: false })
      setProfiles(profs || [])
      addLog(`Empleados cargados: ${(profs || []).length}`)
    } else {
      addLog('No se encontró negocio')
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
    showMessage('✅ Cambios guardados', 'success')
    setTimeout(() => setSaved(false), 3000)
  }

  const openAddEmployee = () => {
    setEditingEmployee(null)
    setEmpForm({
      email: '', name: '', password: '', role: 'seller',
      permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: true, expenses: false }
    })
    setMessage({ text: '', type: '' })
    setDebugLogs([])
    setShowEmployeeModal(true)
  }

  const openEditEmployee = (emp: any) => {
    setEditingEmployee(emp)
    setEmpForm({
      email: emp.email || '',
      name: emp.full_name || '',
      password: '',
      role: emp.role || 'seller',
      permissions: emp.permissions || { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: true, expenses: false }
    })
    setMessage({ text: '', type: '' })
    setDebugLogs([])
    setShowEmployeeModal(true)
  }

  const handleSaveEmployee = async () => {
    addLog('=== Iniciando guardado ===')
    setDebugLogs([])
    
    if (!empForm.name) {
      showMessage('❌ El nombre es obligatorio', 'error')
      return
    }

    if (!editingEmployee) {
      if (!empForm.email || !empForm.password) {
        showMessage('❌ Email y contraseña son obligatorios', 'error')
        return
      }
      if (empForm.password.length < 6) {
        showMessage('❌ La contraseña debe tener al menos 6 caracteres', 'error')
        return
      }
    }

    if (!business) {
      showMessage('❌ No se encontró el negocio', 'error')
      return
    }

    setSaving(true)
    addLog('Estado: Guardando...')

    try {
      if (editingEmployee) {
        // EDITAR
        addLog('Modo: EDITAR empleado existente')
        const updateData: any = {
          full_name: empForm.name,
          role: empForm.role,
          permissions: empForm.permissions,
        }
        addLog(`Actualizando perfil ID: ${editingEmployee.id}`)

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editingEmployee.id)

        if (error) {
          addLog(`Error al editar: ${error.message}`)
          showMessage('❌ Error al editar: ' + error.message, 'error')
        } else {
          addLog('✅ Perfil actualizado exitosamente')
          showMessage('✅ Empleado actualizado', 'success')
          setShowEmployeeModal(false)
          loadData()
        }
      } else {
        // CREAR
        addLog('Modo: CREAR nuevo empleado')
        addLog(`Email: ${empForm.email}`)
        addLog('Creando usuario en Supabase Auth...')

        const { data, error: authError } = await supabase.auth.signUp({
          email: empForm.email,
          password: empForm.password,
        })

        if (authError) {
          addLog(`Error de Auth: ${authError.message}`)
          showMessage('❌ Error: ' + authError.message, 'error')
          setSaving(false)
          return
        }

        addLog(`Respuesta Auth: ${JSON.stringify(data?.user ? 'Usuario creado' : 'Sin usuario')}`)

        if (data.user) {
          addLog(`User ID: ${data.user.id}`)
          addLog('Insertando perfil en base de datos...')

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.user.id,
              business_id: business.id,
              role: empForm.role,
              full_name: empForm.name,
              email: empForm.email,
              active: true,
              permissions: empForm.permissions,
            })
            .select()

          if (profileError) {
            addLog(`Error al insertar perfil: ${profileError.message}`)
            showMessage('❌ Error al crear perfil: ' + profileError.message, 'error')
          } else {
            addLog('✅ Perfil creado exitosamente')
            addLog(`Perfil ID: ${profileData?.[0]?.id}`)
            showMessage('✅ Empleado creado exitosamente', 'success')
            setEmpForm({
              email: '', name: '', password: '', role: 'seller',
              permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: true, expenses: false }
            })
            setShowEmployeeModal(false)
            loadData()
          }
        } else {
          addLog('No se recibió user ID de Auth')
          showMessage('❌ No se pudo crear el usuario. Verifica que el email no esté registrado.', 'error')
        }
      }
    } catch (err: any) {
      addLog(`Error inesperado: ${err.message || 'Desconocido'}`)
      showMessage('❌ Error: ' + (err.message || 'Desconocido'), 'error')
    }

    addLog('=== Fin del proceso ===')
    setSaving(false)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from('profiles').update({ active }).eq('id', id)
    showMessage(active ? '✅ Empleado activado' : '⚠️ Empleado desactivado', 'success')
    loadData()
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Eliminar este empleado?')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) {
      showMessage('❌ Error: ' + error.message, 'error')
    } else {
      showMessage('✅ Empleado eliminado', 'success')
      loadData()
    }
  }

  const updatePermission = (key: string, value: boolean) => {
    setEmpForm({ ...empForm, permissions: { ...empForm.permissions, [key]: value } })
  }

  const applyRolePermissions = (role: string) => {
    const defaultPermissions = {
      manager: { dashboard: true, pos: true, products: true, inventory: true, reports: true, suppliers: true, clients: true, expenses: true },
      seller: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: true, expenses: false }
    }
    setEmpForm({ ...empForm, role: role as any, permissions: defaultPermissions[role as keyof typeof defaultPermissions] })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuración</h1>

      {message.text && (
        <div className={`mb-6 px-4 py-3 rounded-xl font-semibold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
      
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('general')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'general' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>🏢 General</button>
        <button onClick={() => setTab('employees')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'employees' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>👥 Empleados</button>
      </div>

      {tab === 'general' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div>
            <label className="text-sm font-medium block mb-2">Nombre del Negocio</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Moneda</label>
            <div className="flex gap-2 flex-wrap">
              {['$', '€', 'RD$', 'Q', 'L', 'S/', 'Bs', '₡'].map((s) => (
                <button key={s} onClick={() => setCurrency(s)} className={`px-4 py-2 rounded-xl border-2 font-semibold ${currency === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">IVA (%)</label>
            <input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="w-32 px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={handleSave} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
            {saved ? '✓ Guardado' : '💾 Guardar'}
          </button>
        </div>
      )}

      {tab === 'employees' && (
        <div>
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">👥 Empleados</h2>
              <button onClick={openAddEmployee} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-sm">+ Agregar</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {profiles.filter(p => p.role !== 'owner').map((emp: any) => {
              const perms = emp.permissions || {}
              const allowedModules = Object.entries(perms).filter(([k, v]) => v).map(([k]) => k).join(', ')
              return (
                <div key={emp.id} className="p-4 border-b hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-lg font-medium">
                      {(emp.full_name || emp.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{emp.full_name || 'Sin nombre'}</p>
                      <p className="text-sm text-gray-500">{emp.email}</p>
                      <p className="text-xs text-gray-400 mt-1"><strong>Permisos:</strong> {allowedModules || 'Sin permisos'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${emp.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {emp.role === 'manager' ? 'Gerente' : 'Vendedor'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => openEditEmployee(emp)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200">✏️ Editar</button>
                      <button onClick={() => handleToggleActive(emp.id, !emp.active)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {emp.active ? 'Activo' : 'Inactivo'}
                      </button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">🗑️</button>
                    </div>
                  </div>
                </div>
              )
            })}
            {profiles.filter(p => p.role !== 'owner').length === 0 && (
              <div className="p-8 text-center text-gray-400"><p className="text-4xl mb-3">👥</p><p>No hay empleados aún</p></div>
            )}
          </div>
        </div>
      )}

      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">{editingEmployee ? '✏️ Editar Empleado' : '👤 Nuevo Empleado'}</h2>

            {message.text && (
              <div className={`mb-4 px-4 py-3 rounded-xl font-semibold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}

            {debugLogs.length > 0 && (
              <div className="mb-4 bg-gray-900 text-green-400 rounded-xl p-3 font-mono text-xs max-h-40 overflow-y-auto">
                {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Nombre completo *</label>
                <input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Juan Pérez" />
              </div>

              {!editingEmployee && (
                <>
                  <div>
                    <label className="text-sm font-medium block mb-2">Email *</label>
                    <input type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="empleado@email.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Contraseña *</label>
                    <input type="password" value={empForm.password} onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Mínimo 6 caracteres" />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium block mb-2">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => applyRolePermissions('manager')} className={`p-3 rounded-xl border-2 text-left ${empForm.role === 'manager' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                    <p className="font-semibold text-sm">🏢 Gerente</p>
                  </button>
                  <button onClick={() => applyRolePermissions('seller')} className={`p-3 rounded-xl border-2 text-left ${empForm.role === 'seller' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                    <p className="font-semibold text-sm">🛒 Vendedor</p>
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">🔐 Permisos</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'dashboard', label: '📊 Dashboard' },
                    { key: 'pos', label: '🛒 Punto de Venta' },
                    { key: 'products', label: '📦 Productos' },
                    { key: 'inventory', label: '🏷️ Inventario' },
                    { key: 'reports', label: '📈 Reportes' },
                    { key: 'suppliers', label: '🚚 Proveedores' },
                    { key: 'clients', label: '👥 Clientes' },
                    { key: 'expenses', label: '💸 Gastos' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={(empForm.permissions as any)[key]} onChange={(e) => updatePermission(key, e.target.checked)} className="w-4 h-4 rounded" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveEmployee} disabled={saving} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50">
                {saving ? 'Guardando...' : (editingEmployee ? '💾 Guardar' : '✅ Crear')}
              </button>
              <button onClick={() => { setShowEmployeeModal(false); setMessage({ text: '', type: '' }); setDebugLogs([]) }} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
