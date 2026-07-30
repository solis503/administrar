'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ concept: '', amount: '', category: 'Otros', notes: '' })
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
      const [exp, sal] = await Promise.all([
        supabase.from('expenses').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
        supabase.from('sales').select('total').eq('business_id', biz.id),
      ])
      setExpenses(exp.data || [])
      setSales(sal.data || [])
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.concept || !form.amount || !business) return
    await supabase.from('expenses').insert({ ...form, amount: parseFloat(form.amount), business_id: business.id })
    setForm({ concept: '', amount: '', category: 'Otros', notes: '' })
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar gasto?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadData()
  }

  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalSales = sales.reduce((s, v) => s + Number(v.total), 0)
  const profit = totalSales - totalExp
  const curr = business?.currency_symbol || '$'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">💸 Gastos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Total Gastos</p><p className="text-2xl font-bold text-red-500">{curr}{totalExp.toFixed(2)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Total Ventas</p><p className="text-2xl font-bold text-green-600">{curr}{totalSales.toFixed(2)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Ganancia Neta</p><p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{curr}{profit.toFixed(2)}</p></div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Registro de Gastos</h2>
        <button onClick={() => setShowForm(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">+ Registrar Gasto</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Fecha</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Concepto</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Categoría</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Monto</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{new Date(e.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-sm font-medium">{e.concept}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{e.category}</span></td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600">{curr}{Number(e.amount).toFixed(2)}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDelete(e.id)} className="text-red-500 text-xs">Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenses.length === 0 && <div className="p-12 text-center text-gray-400"><p className="text-4xl mb-3">💸</p>No hay gastos registrados</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">💸 Registrar Gasto</h2>
            <div className="space-y-3">
              <input value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Concepto (ej: Renta, Luz) *" />
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Monto *" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none">
                <option>Alquiler</option><option>Servicios</option><option>Nómina</option><option>Proveedores</option><option>Mantenimiento</option><option>Otros</option>
              </select>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Notas (opcional)" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl">💸 Registrar</button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
