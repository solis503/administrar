'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBusiness } from '@/lib/business-context'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState<any>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [savingAdjust, setSavingAdjust] = useState(false)
  const supabase = createClient()
  const { business, loading: businessLoading } = useBusiness()

  useEffect(() => {
    if (business) loadData()
    else if (!businessLoading) setLoading(false)
  }, [business])

  const loadData = async () => {
    if (!business) return
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('business_id', business.id).eq('active', true).order('name')
    setClients(data || [])
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

  const openAdjust = (client: any) => {
    setAdjusting(client)
    setAdjustPoints(String(client.loyalty_points || 0))
  }

  const saveAdjust = async () => {
    if (!adjusting) return
    setSavingAdjust(true)
    const newPoints = Math.max(0, parseInt(adjustPoints) || 0)
    await supabase.from('clients').update({ loyalty_points: newPoints }).eq('id', adjusting.id)
    setSavingAdjust(false)
    setAdjusting(null)
    loadData()
  }

  const curr = business?.currency_symbol || '$'
  const loyaltyEnabled = !!business?.enable_loyalty_program
  const rate = Number(business?.loyalty_points_rate ?? 10)

  if (businessLoading || loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">👥 Clientes</h1>
        <button onClick={() => setShowForm(true)} className="bg-primary-600 text-white px-4 py-2 rounded-xl font-semibold text-sm self-start sm:self-auto">+ Nuevo Cliente</button>
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
                  <td className="px-4 py-3">
                    <button onClick={() => openAdjust(c)} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold hover:bg-yellow-200">
                      ⭐ {c.loyalty_points || 0}
                    </button>
                  </td>
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
        {loyaltyEnabled && rate > 0 ? (
          <p className="text-sm text-yellow-700">
            Ahorita tus clientes ganan <strong>{rate} {rate === 1 ? 'punto' : 'puntos'}</strong> por cada {curr}1 que gastan — elegí el cliente en el Punto de Venta al cobrar para que sume solo. Cambiá la tasa en Configuración.
          </p>
        ) : (
          <p className="text-sm text-yellow-700">
            El programa de lealtad está apagado ahorita. Activalo en Configuración → "⭐ Programa de lealtad" para que aparezca el selector de cliente al cobrar en el POS.
          </p>
        )}
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

      {adjusting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-1">⭐ Ajustar puntos</h2>
            <p className="text-sm text-gray-500 mb-4">{adjusting.name} — usalo si querés corregir un error o regalar puntos por una promoción.</p>
            <label className="text-sm font-medium block mb-1">Puntos totales</label>
            <input
              type="number"
              min="0"
              value={adjustPoints}
              onChange={e => setAdjustPoints(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border outline-none text-lg text-center mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={saveAdjust} disabled={savingAdjust} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl disabled:opacity-50">
                {savingAdjust ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setAdjusting(null)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
