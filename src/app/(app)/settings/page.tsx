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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: ownerBiz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single()

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
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, businesses(*)')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      if (profile && profile.businesses) {
        setBusiness(profile.businesses)
        setName(profile.businesses.name)
        setCurrency(profile.businesses.currency_symbol)
        setTax(String(profile.businesses.tax_percentage))
      }
    }
    
    setLoading(false)
  }

  const handleSave = async () => {
    if (!business) {
      alert('No se encontró el negocio')
      return
    }
    
    await supabase
      .from('businesses')
      .update({
        name,
        currency_symbol: currency,
        tax_percentage: parseFloat(tax) || 0,
        loyalty_points_rate: parseFloat(loyaltyRate) || 10,
      })
      .eq('id', business.id)

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAddEmployee = async () => {
    if (!empForm.email || !empForm.password || !empForm.name) {
      alert('Por favor llena todos los campos')
      return
    }
    if (empForm.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (!business) {
      alert('No se encontró el negocio')
      return
    }

    setAddingEmployee(true)
    const { data, error } = await supabase.auth.signUp({
      email: empForm.email,
      password: empForm.password,
    })

    if (error) {
      alert('Error: ' + error.message)
      setAddingEmployee(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        business_id: business.id,
        role: empForm.role,
        full_name: empForm.name,
        email: empForm.email,
        active: true,
      })
      setEmpForm({ email: '', name: '', password: '', role: 'seller' })
      setShowAddEmployee(false)
      loadData()
    }
    setAddingEmployee(false)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from('profiles').update({ active }).eq('id', id)
    loadData()
  }

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Eliminar?')) return
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuración</h1>
      
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
              <button onClick={() => setShowAddEmployee(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">+ Agregar</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {profiles.filter(p => p.role !== 'owner').map((emp: any) => (
              <div key={emp.id} className="p-4 border-b flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{emp.full_name}</p>
                  <p className="text-sm text-gray-500">{emp.email}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${emp.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {emp.role === 'manager' ? 'Gerente' : 'Vendedor'}
                </span>
                <button onClick={() => handleToggleActive(emp.id, !emp.active)} className={`px-3 py-1.5 rounded-lg text-sm ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {emp.active ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-600">🗑️</button>
              </div>
            ))}
            {profiles.filter(p => p.role !== 'owner').length === 0 && (
              <div className="p-8 text-center text-gray-400">No hay empleados aún</div>
            )}
          </div>
        </div>
      )}

      {showAddEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">👤 Nuevo Empleado</h2>
            <div className="space-y-4">
              <input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Nombre completo" />
              <input type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Email" />
              <input type="password" value={empForm.password} onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Contraseña (mín. 6 caracteres)" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEmpForm({ ...empForm, role: 'manager' })} className={`p-3 rounded-xl border-2 ${empForm.role === 'manager' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                  <p className="font-semibold text-sm">🏢 Gerente</p>
                </button>
                <button onClick={() => setEmpForm({ ...empForm, role: 'seller' })} className={`p-3 rounded-xl border-2 ${empForm.role === 'seller' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                  <p className="font-semibold text-sm">🛒 Vendedor</p>
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddEmployee} disabled={addingEmployee} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50">
                {addingEmployee ? 'Creando...' : '✅ Crear'}
              </button>
              <button onClick={() => setShowAddEmployee(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
