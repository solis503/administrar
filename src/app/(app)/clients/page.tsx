'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let biz: any = null
    const { data: ob } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (ob) biz = ob
    else { const { data: pr } = await supabase.from('profiles').select('*, businesses(*)').eq('user_id', user.id).single(); if (pr) biz = pr.businesses }
    if (biz) {
      setBusiness(biz)
      const { data } = await supabase.from('clients').select('*').eq('business_id', biz.id).eq('active', true).order('name')
      setClients(data || [])
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name || !business) return
    await supabase.from('clients').insert({ ...form, business_id: business.id })
    setForm({ name: '', phone: '', email: '' })
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar cliente?')) return
    await supabase.from('clients').update({ active: false }).eq('id', id)
    loadData()
  }

  const curr = business?.currency_symbol || '$'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">👥 Clientes</h1>
        <button onClick={() => setShowForm(true)} className="bg-primary-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">+ Nuevo Cliente</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Puntos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Crédito</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="font-medium">{c.name}</div><div className="text-xs text-gray-400">{c.email}</div></td>
                  <td className="px-4 py-3 text-sm">{c.phone || '-'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">⭐ {c.loyalty_points || 0}</span></td>
                  <td className="px-4 py-3"><span className={`font-semibold ${Number(c.credit_balance || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>{curr}{Number(c.credit_balance || 0).toFixed(2)}</span></td>
                  <td className="px-4 py-3 text-sm font-semibold">{curr}{Number(c.total_spent || 0).toFixed(2)}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDelete(c.id)} className="text-red-500 text-xs">Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clients.length === 0 && <div className="p-12 text-center text-gray-400"><p className="text-4xl mb-3">👥</p>No hay clientes aún</div>}
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
        <h3 className="font-semibold text-yellow-800 mb-1">⭐ Programa de Lealtad</h3>
        <p className="text-sm text-yellow-700">Los clientes ganan puntos con cada compra. Configura la tasa en Configuración.</p>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">👤 Nuevo Cliente</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Nombre completo *" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Teléfono" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Email" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl">✅ Agregar</button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
