'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBranch } from '@/lib/branch-context'
import { getProductCostMap, calculateCOGS } from '@/lib/cogs'

type Period = 'today' | 'week' | 'month' | 'custom'

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [cogs, setCogs] = useState(0)
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { selectedBranchId } = useBranch()

  useEffect(() => { loadData() }, [period, customFrom, customTo, selectedBranchId])

  const getDateRange = () => {
    const now = new Date()
    let since: Date
    let until: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      since = new Date(now.getTime() - 7 * 86400000)
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      // Personalizado: si no se eligió nada todavía, usamos hoy como default
      since = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), now.getDate())
      until = customTo ? new Date(customTo + 'T23:59:59.999') : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    }
    return { since, until }
  }

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    let biz: any = null
    const { data: ob } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (ob) biz = ob
    else { const { data: pr } = await supabase.from('profiles').select('*, businesses(*)').eq('user_id', user.id).single(); if (pr) biz = pr.businesses }
    if (!biz) { setLoading(false); return }
    setBusiness(biz)

    const { since, until } = getDateRange()

    let salesQuery = supabase.from('sales').select('*').eq('business_id', biz.id)
      .gte('created_at', since.toISOString()).lte('created_at', until.toISOString())
      .order('created_at', { ascending: false })
    let expensesQuery = supabase.from('expenses').select('*').eq('business_id', biz.id)
      .gte('created_at', since.toISOString()).lte('created_at', until.toISOString())

    if (selectedBranchId) {
      salesQuery = salesQuery.eq('branch_id', selectedBranchId)
      expensesQuery = expensesQuery.eq('branch_id', selectedBranchId)
    }

    const [salesRes, expensesRes] = await Promise.all([salesQuery, expensesQuery])
    const salesData = salesRes.data || []
    setSales(salesData)
    setExpenses(expensesRes.data || [])

    const saleIds = salesData.map((s: any) => s.id)
    let items: any[] = []
    if (saleIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('product_id, product_name, quantity, unit_price, subtotal, cost')
        .in('sale_id', saleIds)
      items = itemsData || []
    }
    setSaleItems(items)

    // Costo real de lo vendido (incluye recetas: suma costo de cada ingrediente)
    const costMap = await getProductCostMap(supabase, biz.id)
    setCogs(calculateCOGS(items, costMap))

    setLoading(false)
  }

  const totalSales = sales.reduce((s, v) => s + Number(v.total), 0)
  const totalExp = expenses.reduce((s, v) => s + Number(v.amount), 0)
  const gananciaBruta = totalSales - cogs
  const curr = business?.currency_symbol || '$'

  const byMethod: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 }
  sales.forEach(s => { byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total) })

  const prodCount: Record<string, number> = {}
  saleItems.forEach(p => { prodCount[p.product_name] = (prodCount[p.product_name] || 0) + Number(p.quantity) })
  const topProds: [string, number][] = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxProd: number = topProds.length ? topProds[0][1] : 1

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📈 Reportes</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {([['today', 'Hoy'], ['week', 'Semana'], ['month', 'Mes'], ['custom', '📅 Personalizado']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${period === v ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 mb-6 bg-white border rounded-xl p-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Desde</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Hasta</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" />
          </div>
          <p className="text-xs text-gray-400 pb-2">Para ver un solo día, poné la misma fecha en "Desde" y "Hasta"</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Total Ventas</p><p className="text-2xl font-bold text-primary-600">{curr}{totalSales.toFixed(0)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Transacciones</p><p className="text-2xl font-bold">{sales.length}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Costo de Productos</p><p className="text-2xl font-bold text-orange-500">{curr}{cogs.toFixed(0)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Gastos</p><p className="text-2xl font-bold text-red-500">{curr}{totalExp.toFixed(0)}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500">Ganancia Bruta <span className="text-gray-400">(ventas − costo)</span></p>
          <p className={`text-2xl font-bold ${gananciaBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{curr}{gananciaBruta.toFixed(2)}</p>
        </div>
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
        {sales.length === 0 && <p className="text-center text-gray-400 py-8">No hay ventas en este rango de fechas</p>}
      </div>
    </div>
  )
}
