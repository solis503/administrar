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
  const [showManualCreate, setShowManualCreate] = useState(false)
  const [manualUserId, setManualUserId] = useState('')
  const [empForm, setEmpForm] = useState({
    email: '', name: '', password: '', role: 'seller',
    permissions: { dashboard: false, pos: true, products: false, inventory: false, reports: false, suppliers: false, clients: true, expenses: false }
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [manualStep, setManualStep] = useState(1)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const showMessage = (text: string, type: string) => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 5000)
  }

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: ownerBiz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()

    if (ownerBiz) {
      setBusiness(ownerBiz)
      setName(ownerBiz.name)
      setCurrency(ownerBiz.currency_symbol)
      setTax(String(ownerBiz.tax_percentage))
      setLoyaltyRate(String(ownerBiz.loyalty_points_rate || 10))
      
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .eq('business_id', ownerBiz.id)
        .order('created_at', { ascending: false })
      
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
    setManualUserId('')
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
    setShowEmployeeModal(true)
  }

  const handleSaveEmployee = async () => {
    if (!empForm.name) {
      showMessage('❌ El nombre es obligatorio', 'error')
      return
    }

    if (!business) {
      showMessage('❌ No se encontró el negocio', 'error')
      return
    }

    setSaving(true)

    try {
      if (editingEmployee) {
        // EDITAR
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: empForm.name,
            role: empForm.role,
            permissions: empForm.permissions,
          })
          .eq('id', editingEmployee.id)

        if (error) {
          showMessage('❌ Error: ' + error.message, 'error')
        } else {
          showMessage('✅ Empleado actualizado', 'success')
          await loadData()
          setShowEmployeeModal(false)
          setEditingEmployee(null)
        }
      } else if (manualUserId) {
        // CREAR CON USER ID MANUAL
        const { error } = await supabase.from('profiles').insert({
          user_id: manualUserId,
          business_id: business.id,
          role: empForm.role,
          full_name: empForm.name,
          email: empForm.email,
          active: true,
          permissions: empForm.permissions,
        })

        if (error) {
          showMessage('❌ Error: ' + error.message, 'error')
        } else {
          showMessage('✅ Empleado creado', 'success')
          await loadData()
          setShowEmployeeModal(false)
        }
      } else {
        // INTENTAR CREAR AUTOMÁTICAMENTE
        if (!empForm.email || !empForm.password) {
          showMessage('❌ Email y contraseña son obligatorios', 'error')
          setSaving(false)
          return
        }

        const { data, error: authError } = await supabase.auth.signUp({
          email: empForm.email,
          password: empForm.password,
        })

        if (authError || !data.user) {
          // Si falla, mostrar opción manual
          showMessage('⚠️ No se pudo crear automáticamente. Usa el método manual.', 'error')
          setSaving(false)
          setManualStep(1)
          setShowManualCreate(true)
          return
        }

        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          business_id: business.id,
          role: empForm.role,
          full_name: empForm.name,
          email: empForm.email,
          active: true,
          permissions: empForm.permissions,
        })

        if (profileError) {
          showMessage('❌ Error: ' + profileError.message, 'error')
        } else {
          showMessage('✅ Empleado creado', 'success')
          await loadData()
          setShowEmployeeModal(false)
        }
      }
    } catch (err: any) {
      showMessage('❌ Error: ' + err.message, 'error')
    }

    setSaving(false)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('profiles').update({ active }).eq('id', id)
    if (error) {
      showMessage('❌ Error: ' + error.message, 'error')
    } else {
      showMessage(active ? '✅ Activado' : '⚠️ Desactivado', 'success')
      await loadData()
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Eliminar este empleado?')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) {
      showMessage('❌ Error: ' + error.message, 'error')
    } else {
      showMessage('✅ Eliminado', 'success')
      await loadData()
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

  const generateManualSQL = () => {
    if (!business) return ''
    const perms = JSON.stringify(empForm.permissions)
    return `INSERT INTO profiles (user_id, business_id, role, full_name, email, active, permissions) VALUES (
  '${manualUserId}'::uuid,
  '${business.id}'::uuid,
  '${empForm.role}',
  '${empForm.name}',
  '${empForm.email}',
  true,
  '${perms}'::jsonb
);`
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuración</h1>

      {message.text && (
        <div className={`mb-6 px-4 py-3 rounded-xl font-semibold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
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

      {/* Modal Crear/Editar Empleado */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">{editingEmployee ? '✏️ Editar Empleado' : '👤 Nuevo Empleado'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Nombre completo *</label>
                <input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Juan Pérez" />
              </div>

              {!editingEmployee && !manualUserId && (
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

              {editingEmployee && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                  <p><strong>Email:</strong> {empForm.email}</p>
                </div>
              )}

              {/* Input para User ID manual */}
              {!editingEmployee && manualUserId && (
                <div>
                  <label className="text-sm font-medium block mb-2">Email del empleado</label>
                  <input value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" />
                  <p className="text-xs text-gray-500 mt-1">El usuario ya fue creado en Supabase Auth</p>
                </div>
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
              {editingEmployee || manualUserId ? (
                <button onClick={handleSaveEmployee} disabled={saving} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50">
                  {saving ? 'Guardando...' : '💾 Guardar'}
                </button>
              ) : (
                <>
                  <button onClick={handleSaveEmployee} disabled={saving} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50">
                    {saving ? 'Creando...' : '✅ Crear Automático'}
                  </button>
                  <button onClick={() => { setManualStep(1); setShowManualCreate(true) }} className="px-4 py-3 bg-gray-600 text-white font-bold rounded-xl">
                    🔧 Manual
                  </button>
                </>
              )}
              <button onClick={() => { setShowEmployeeModal(false); setShowManualCreate(false); setManualUserId('') }} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Manual */}
      {showManualCreate && !editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">🔧 Crear Empleado Manualmente</h2>
            
            <div className="space-y-4">
              {/* Paso 1 */}
              <div className={`p-4 rounded-xl border-2 ${manualStep >= 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                <h3 className="font-semibold mb-2">Paso 1: Crear usuario en Supabase Auth</h3>
                <ol className="list-decimal list-inside text-sm space-y-1 mb-3">
                  <li>Abre <a href="https://supabase.com/dashboard" target="_blank" className="text-blue-600 underline">Supabase Dashboard</a></li>
                  <li>Ve a tu proyecto → <strong>Authentication</strong> → <strong>Users</strong></li>
                  <li>Clic en <strong>"Add user"</strong> → <strong>"Create new user"</strong></li>
                  <li>Email: <strong>{empForm.email || 'email del empleado'}</strong></li>
                  <li>Password: (la que el empleado usará)</li>
                  <li>✅ <strong>Activa "Auto Confirm User"</strong></li>
                  <li>Clic en <strong>"Create user"</strong></li>
                </ol>
                <div>
                  <label className="text-sm font-medium block mb-2">Pega aquí el User UID:</label>
                  <input 
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border outline-none font-mono text-sm"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
              </div>

              {/* Paso 2 */}
              <div className={`p-4 rounded-xl border-2 ${manualStep >= 2 && manualUserId ? 'border-green-600 bg-green-50' : 'border-gray-300'}`}>
                <h3 className="font-semibold mb-2">Paso 2: Ejecutar el SQL</h3>
                {manualUserId ? (
                  <>
                    <p className="text-sm text-gray-600 mb-2">Copia este SQL y ejecútalo en <strong>SQL Editor</strong> de Supabase:</p>
                    <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                      <pre>{generateManualSQL()}</pre>
                    </div>
                    <button 
                      onClick={() => { 
                        navigator.clipboard.writeText(generateManualSQL())
                        showMessage('✅ SQL copiado al portapapeles', 'success')
                      }}
                      className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold"
                    >
                      📋 Copiar SQL
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Primero pega el User UID del paso 1</p>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { setShowManualCreate(false) }}
                className="px-6 py-3 bg-gray-100 rounded-xl font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
