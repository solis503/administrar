'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function ReportsPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [period])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let biz: any = null
    const { data: ob } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (ob) biz = ob
    else { const { data: pr } = await supabase.from('profiles').select('*, businesses(*)').eq('user_id', user.id).single(); if (pr) biz = pr.businesses }
    if (!biz) { setLoading(false); return }
    setBusiness(biz)

    const now = new Date()
    let since = new Date()
    if (period === 'today') since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    else if (period === 'week') since = new Date(now.getTime() - 7 * 86400000)
    else since = new Date(now.getFullYear(), now.getMonth(), 1)

    const [s, e, items] = await Promise.all([
      supabase.from('sales').select('*').eq('business_id', biz.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('business_id', biz.id).gte('created_at', since.toISOString()),
      supabase.from('sale_items').select('product_name, quantity, unit_price').in('sale_id', (await supabase.from('sales').select('id').eq('business_id', biz.id).gte('created_at', since.toISOString())).data?.map((x: any) => x.id) || []),
    ])
    setSales(s.data || [])
    setExpenses(e.data || [])
    setProducts(items.data || [])
    setLoading(false)
  }

  const totalSales = sales.reduce((s, v) => s + Number(v.total), 0)
  const totalExp = expenses.reduce((s, v) => s + Number(v.amount), 0)
  const profit = totalSales - totalExp
  const curr = business?.currency_symbol || '$'

  const byMethod: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 }
  sales.forEach(s => { byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total) })

  const prodCount: Record<string, number> = {}
  products.forEach(p => { prodCount[p.product_name] = (prodCount[p.product_name] || 0) + Number(p.quantity) })
  const topProds: [string, number][] = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxProd: number = topProds.length ? topProds[0][1] : 1

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📈 Reportes</h1>
      <div className="flex gap-2 mb-6">
        {([['today', 'Hoy'], ['week', 'Semana'], ['month', 'Mes']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${period === v ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Total Ventas</p><p className="text-2xl font-bold text-primary-600">{curr}{totalSales.toFixed(0)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Transacciones</p><p className="text-2xl font-bold">{sales.length}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Gastos</p><p className="text-2xl font-bold text-red-500">{curr}{totalExp.toFixed(0)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Ganancia</p><p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{curr}{profit.toFixed(0)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">💳 Ventas por Método</h2>
          <div className="space-y-3">
            {Object.entries(byMethod).map(([m, v]) => {
              const pct = totalSales > 0 ? (v / totalSales * 100) : 0
              const colors: any = { efectivo: 'bg-green-500', tarjeta: 'bg-blue-500', transferencia: 'bg-purple-500' }
              const labels: any = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia' }
              return (
                <div key={m}>
                  <div className="flex justify-between text-sm mb-1"><span>{labels[m]}</span><span className="font-semibold">{curr}{Number(v).toFixed(2)} ({pct.toFixed(0)}%)</span></div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${colors[m]} rounded-full`} style={{ width: `${pct}%` }}></div></div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">🏆 Más Vendidos</h2>
          <div className="space-y-3">
            {topProds.length > 0 ? topProds.map(([name, qty]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1"><span className="truncate pr-2">{name}</span><span className="font-semibold">{qty} uds</span></div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${(qty / maxProd * 100)}%` }}></div></div>
              </div>
            )) : <p className="text-gray-400 text-center text-sm py-4">Sin datos</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">🧾 Detalle de Ventas</h2>
          <button onClick={() => alert('📄 Exportando a Excel...')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold">📥 Exportar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Fecha</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Total</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Método</th>
            </tr></thead>
            <tbody className="divide-y">
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{new Date(s.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2 font-semibold">{curr}{Number(s.total).toFixed(2)}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.payment_method === 'efectivo' ? 'bg-green-100 text-green-700' : s.payment_method === 'tarjeta' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{s.payment_method}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
