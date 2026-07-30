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
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [empForm, setEmpForm] = useState({ email: '', name: '', password: '', role: 'seller' })
  const [addingEmployee, setAddingEmployee] = useState(false)
  const supabase = createClient()

  useEffect(() => { 
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No hay usuario')
        setLoading(false)
        return
      }

      // Buscar negocio como owner
      const { data: ownerBiz, error: ownerError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      let b: any = null
      
      if (ownerBiz && !ownerError) {
        b = ownerBiz
        console.log('Negocio encontrado como owner:', b)
      } else {
        // Buscar como empleado
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, businesses(*)')
          .eq('user_id', user.id)
          .eq('active', true)
          .single()

        if (profile && profile.businesses) {
          b = profile.businesses
          console.log('Negocio encontrado como empleado:', b)
        }
      }

      if (b) {
        setBusiness(b)
        setName(b.name || '')
        setCurrency(b.currency_symbol || '$')
        setTax(String(b.tax_percentage || 13))
        setLoyaltyRate(String(b.loyalty_points_rate || 10))
        
        // Cargar empleados si es owner
        if (ownerBiz && !ownerError) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('*')
            .eq('business_id', b.id)
            .order('created_at', { ascending: false })
          setProfiles(profs || [])
        }
      } else {
        console.log('No se encontró negocio')
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!business || !business.id) {
      alert('Error: No se encontró el negocio. Recarga la página.')
      return
    }
    
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: name,
          currency_symbol: currency,
          tax_percentage: parseFloat(tax) || 0,
          loyalty_points_rate: parseFloat(loyaltyRate) || 10,
        })
        .eq('id', business.id)

      if (error) {
        alert('Error al guardar: ' + error.message)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        loadData() // Recargar datos
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleAddEmployee = async () => {
    if (!empForm.email || !empForm.password || !empForm.name) {
      alert('Por favor llena todos los campos: nombre, email y contraseña')
      return
    }
    
    if (empForm.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }
    
    if (!business || !business.id) {
      alert('Error: No se encontró el negocio. Recarga la página.')
      return
    }

    setAddingEmployee(true)
    
    try {
      // Crear usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: empForm.email,
        password: empForm.password,
      })

      if (error) {
        alert('Error al crear usuario: ' + error.message)
        setAddingEmployee(false)
        return
      }

      if (data.user) {
        // Crear perfil del empleado
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            business_id: business.id,
            role: empForm.role,
            full_name: empForm.name,
            email: empForm.email,
            active: true,
          })

        if (profileError) {
          alert('Error al crear perfil: ' + profileError.message)
        } else {
          alert('✅ Empleado creado exitosamente')
          setEmpForm({ email: '', name: '', password: '', role: 'seller' })
          setShowAddEmployee(false)
          loadData()
        }
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
    
    setAddingEmployee(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-600">No se encontró el negocio</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl">Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuración</h1>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('general')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'general' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>🏢 General</button>
        <button onClick={() => setTab('employees')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'employees' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>👥 Empleados</button>
        <button onClick={() => setTab('branches')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'branches' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>📍 Sucursales</button>
        <button onClick={() => setTab('loyalty')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === 'loyalty' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>⭐ Lealtad</button>
      </div>

      {/* Tab General */}
      {tab === 'general' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div>
            <label className="text-sm font-medium block mb-2">Nombre del Negocio</label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="Mi Negocio"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Moneda</label>
            <div className="flex gap-2 flex-wrap">
              {['$', '€', 'RD$', 'Q', 'L', 'S/', 'Bs', '₡', '£', '¥'].map((s) => (
                <button 
                  key={s} 
                  onClick={() => setCurrency(s)} 
                  className={`px-4 py-2 rounded-xl border-2 font-semibold transition ${currency === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-400'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">IVA (%)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                step="0.01" 
                value={tax} 
                onChange={(e) => setTax(e.target.value)} 
                className="w-32 px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="13"
              />
              <span className="font-semibold">%</span>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
          >
            {saved ? '✓ Guardado' : '💾 Guardar'}
          </button>
        </div>
      )}

      {/* Tab Empleados */}
      {tab === 'employees' && (
        <div>
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">👥 Gestión de Empleados</h2>
              <button 
                onClick={() => setShowAddEmployee(true)} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition"
              >
                + Agregar Empleado
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Permisos por Rol</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <strong className="text-yellow-800">👑 Propietario</strong>
                  <p className="text-yellow-700 text-xs mt-1">Acceso total: Todo</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <strong className="text-blue-800">🏢 Gerente</strong>
                  <p className="text-blue-700 text-xs mt-1">Todo excepto configuración</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <strong className="text-green-800">🛒 Vendedor</strong>
                  <p className="text-green-700 text-xs mt-1">Solo Punto de Venta</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-yellow-50 flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">👑</div>
              <div className="flex-1">
                <p className="font-semibold">Tú (Propietario)</p>
                <p className="text-sm text-gray-500">Cuenta principal</p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">Propietario</span>
            </div>
            {profiles.filter((p: any) => p.role !== 'owner').map((emp: any) => (
              <div key={emp.id} className="p-4 border-b flex items-center gap-4 hover:bg-gray-50">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                  {(emp.full_name || emp.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {emp.full_name || 'Sin nombre'}
                    {!emp.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2">Inactivo</span>}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{emp.email}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${emp.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {emp.role === 'manager' ? 'Gerente' : 'Vendedor'}
                </span>
                <button 
                  onClick={() => handleToggleActive(emp.id, !emp.active)} 
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${emp.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                >
                  {emp.active ? 'Activo' : 'Inactivo'}
                </button>
                <button 
                  onClick={() => handleDeleteEmployee(emp.id)} 
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  🗑️
                </button>
              </div>
            ))}
            {profiles.filter((p: any) => p.role !== 'owner').length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <p className="text-4xl mb-3">👥</p>
                <p>No hay empleados aún</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Sucursales */}
      {tab === 'branches' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">📍 Sucursales</h2>
          <div className="flex items-center gap-3 p-3 border rounded-xl bg-green-50">
            <span className="text-lg">📍</span>
            <div className="flex-1"><p className="font-medium">Sucursal Principal</p></div>
            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Activa</span>
          </div>
        </div>
      )}

      {/* Tab Lealtad */}
      {tab === 'loyalty' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-2">⭐ Programa de Lealtad</h2>
          <div>
            <label className="text-sm font-medium block mb-2">Puntos por cada</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={loyaltyRate} 
                onChange={(e) => setLoyaltyRate(e.target.value)} 
                className="w-32 px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
              <span className="text-gray-500">de compra = 1 punto</span>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
          >
            💾 Guardar
          </button>
        </div>
      )}

      {/* Modal Agregar Empleado */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">👤 Nuevo Empleado</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Nombre completo *</label>
                <input 
                  value={empForm.name} 
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Email *</label>
                <input 
                  type="email" 
                  value={empForm.email} 
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="empleado@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Contraseña *</label>
                <input 
                  type="password" 
                  value={empForm.password} 
                  onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setEmpForm({ ...empForm, role: 'manager' })} 
                    className={`p-3 rounded-xl border-2 text-left transition ${empForm.role === 'manager' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}
                  >
                    <p className="font-semibold text-sm">🏢 Gerente</p>
                    <p className="text-xs text-gray-500 mt-1">Todo excepto config</p>
                  </button>
                  <button 
                    onClick={() => setEmpForm({ ...empForm, role: 'seller' })} 
                    className={`p-3 rounded-xl border-2 text-left transition ${empForm.role === 'seller' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}
                  >
                    <p className="font-semibold text-sm">🛒 Vendedor</p>
                    <p className="text-xs text-gray-500 mt-1">Solo POS</p>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleAddEmployee} 
                disabled={addingEmployee} 
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {addingEmployee ? 'Creando...' : '✅ Crear Empleado'}
              </button>
              <button 
                onClick={() => { setShowAddEmployee(false); setEmpForm({ email: '', name: '', password: '', role: 'seller' }) }} 
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
