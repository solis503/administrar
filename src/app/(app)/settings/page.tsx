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
  const [tab, setTab] = useState<'general' | 'users' | 'branches' | 'loyalty'>('general')
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuración</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {[['general', '🏢 General'], ['users', '👥 Usuarios'], ['branches', '📍 Sucursales'], ['loyalty', '⭐ Lealtad']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === v ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div>
            <label className="text-sm font-medium block mb-1">Nombre del Negocio</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Moneda</label>
            <div className="flex gap-2 flex-wrap">
              {['$', '€', 'RD$', 'Q', 'L', 'S/', 'Bs', '₡', '£', '¥'].map(s => (
                <button key={s} onClick={() => setCurrency(s)} className={`px-4 py-2 rounded-xl border-2 font-semibold ${currency === s ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">IVA (%)</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} className="w-32 px-4 py-3 rounded-xl border outline-none" />
              <span className="font-semibold">%</span>
            </div>
          </div>
          <button onClick={handleSave} className="px-8 py-3 bg-primary-600 text-white font-bold rounded-xl">💾 Guardar {saved && '✓'}</button>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <h2 className="font-semibold mb-4">📋 Permisos por Rol</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3"><h3 className="font-bold text-yellow-800 text-sm">👑 Propietario</h3><p className="text-xs text-yellow-700">Acceso total</p></div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3"><h3 className="font-bold text-blue-800 text-sm">🏢 Gerente</h3><p className="text-xs text-blue-700">Todo excepto config</p></div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3"><h3 className="font-bold text-green-800 text-sm">🛒 Vendedor</h3><p className="text-xs text-green-700">Solo vender</p></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'branches' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">📍 Sucursales</h2>
          <p className="text-sm text-gray-500 mb-4">Gestiona las sucursales de tu negocio</p>
          <div className="flex items-center gap-3 p-3 border rounded-xl bg-green-50">
            <span className="text-lg">📍</span>
            <div className="flex-1"><p className="font-medium">Sucursal Principal</p><p className="text-xs text-gray-500">Activa</p></div>
            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Activa</span>
          </div>
        </div>
      )}

      {tab === 'loyalty' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold mb-2">⭐ Programa de Lealtad</h2>
          <div>
            <label className="text-sm font-medium block mb-1">Puntos por cada</label>
            <div className="flex items-center gap-2">
              <input type="number" value={loyaltyRate} onChange={e => setLoyaltyRate(e.target.value)} className="w-32 px-4 py-3 rounded-xl border outline-none" />
              <span className="text-gray-500">de compra = 1 punto</span>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-700">Los clientes acumulan puntos con cada compra.</p>
          </div>
          <button onClick={handleSave} className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl">💾 Guardar</button>
        </div>
      )}
    </div>
  )
}
