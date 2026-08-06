'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBranch } from '@/lib/branch-context'
import { getProductCostMap, calculateCOGS } from '@/lib/cogs'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [business, setBusiness] = useState<any>(null)
  const [salesToday, setSalesToday] = useState<any[]>([])
  const [expensesToday, setExpensesToday] = useState<any[]>([])
  const [saleItemsToday, setSaleItemsToday] = useState<any[]>([])
  const [cogsToday, setCogsToday] = useState(0)
  const [costMap, setCostMap] = useState<Record<string, number>>({})
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [myEntries, setMyEntries] = useState<{ name: string; qty: number; time: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const { selectedBranchId, branches, canSwitchBranches } = useBranch()

  useEffect(() => { loadData() }, [selectedBranchId])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, businesses(*)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    let biz: any = null
    if (profile) {
      biz = Array.isArray(profile.businesses) ? profile.businesses[0] : profile.businesses
    } else {
      const { data: ownerBiz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
      biz = ownerBiz
    }

    if (!biz) { setLoading(false); return }
    setBusiness(biz)

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    let salesQuery = supabase.from('sales').select('*').eq('business_id', biz.id).gte('created_at', startOfDay)
    let expensesQuery = supabase.from('expenses').select('*').eq('business_id', biz.id).gte('created_at', startOfDay)
    let recentSalesQuery = supabase.from('sales').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(5)

    if (selectedBranchId) {
      salesQuery = salesQuery.eq('branch_id', selectedBranchId)
      expensesQuery = expensesQuery.eq('branch_id', selectedBranchId)
      recentSalesQuery = recentSalesQuery.eq('branch_id', selectedBranchId)
    }

    const [salesRes, expensesRes, recentSalesRes] = await Promise.all([
      salesQuery, expensesQuery, recentSalesQuery,
    ])

    const activeToday = (salesRes.data || []).filter((s: any) => s.status !== 'anulada')
    setSalesToday(activeToday)
    setExpensesToday(expensesRes.data || [])
    setRecentSales(recentSalesRes.data || [])

    const todaySaleIds = activeToday.map((s: any) => s.id)
    let items: any[] = []
    if (todaySaleIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, product_name, quantity, cost, returned_quantity')
        .in('sale_id', todaySaleIds)
      items = (itemsData || []).map((it: any) => ({ ...it, quantity: Number(it.quantity) - Number(it.returned_quantity || 0) }))
    }
    setSaleItemsToday(items)
    const costMapResult = await getProductCostMap(supabase, biz.id)
    setCostMap(costMapResult)
    setCogsToday(calculateCOGS(items, costMapResult))

    // Lo que el usuario actual anotó hoy, en orden de hora (solo cantidades, sin montos)
    const saleUserMap: Record<string, string> = {}
    const saleTimeMap: Record<string, string> = {}
    activeToday.forEach((s: any) => { saleUserMap[s.id] = s.user_id; saleTimeMap[s.id] = s.created_at })
    const myList = items
      .filter((it: any) => saleUserMap[it.sale_id] === user.id && it.quantity > 0)
      .map((it: any) => ({ name: it.product_name, qty: it.quantity, time: saleTimeMap[it.sale_id] }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    setMyEntries(myList)

    setLoading(false)
  }

  const currency = business?.currency_symbol || '$'
  const totalVentasHoy = salesToday.reduce((sum, s) => sum + Number(s.total || 0) - Number(s.refunded_total || 0), 0)
  const totalGastosHoy = expensesToday.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const ganancia = totalVentasHoy - cogsToday - totalGastosHoy

  // Cuando el dueño está viendo "Todas las sucursales", armamos el desglose por sucursal
  const showBranchBreakdown = canSwitchBranches && !selectedBranchId && branches.length > 1
  const saleBranchMap: Record<string, string> = {}
  salesToday.forEach((s) => { saleBranchMap[s.id] = s.branch_id })
  const branchBreakdown = branches.map((b) => {
    const ventas = salesToday.filter((s) => s.branch_id === b.id).reduce((sum, s) => sum + Number(s.total || 0) - Number(s.refunded_total || 0), 0)
    const gastos = expensesToday.filter((e) => e.branch_id === b.id).reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const itemsDeSucursal = saleItemsToday.filter((it) => saleBranchMap[it.sale_id] === b.id)
    const costoProductos = calculateCOGS(itemsDeSucursal, costMap)
    return { id: b.id, name: b.name, ventas, gastos, ganancia: ventas - costoProductos - gastos }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">📊 Dashboard</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 border-b"><h2 className="font-semibold">📝 Lo que anotaste hoy <span className="text-xs font-normal text-gray-400">(en orden, por hora en que se registró)</span></h2></div>
        {myEntries.length === 0 ? (
          <div className="p-4 text-center text-gray-400 py-8">Todavía no has registrado ninguna venta hoy</div>
        ) : (
          <div className="divide-y">
            {myEntries.map((entry, i) => (
              <div key={i} className="p-4 flex justify-between items-center">
                <div>
                  <span className="font-medium text-sm">{entry.name}</span>
                  <p className="text-xs text-gray-400">{new Date(entry.time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary-100 text-primary-700">x{entry.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Ventas de Hoy</p>
          <p className="text-3xl font-bold text-blue-600">{currency}{totalVentasHoy.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">{salesToday.length} transacciones</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Costo de Productos</p>
          <p className="text-3xl font-bold text-orange-500">{currency}{cogsToday.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Gastos de Hoy</p>
          <p className="text-3xl font-bold text-red-500">{currency}{totalGastosHoy.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Ganancia</p>
          <p className={`text-3xl font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {currency}{ganancia.toFixed(2)}
          </p>
        </div>
      </div>

      {showBranchBreakdown && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-4 border-b"><h2 className="font-semibold">🏬 Desglose de Hoy por Sucursal</h2></div>
          <div className="divide-y">
            {branchBreakdown.map((b) => (
              <div key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">{b.name}</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-600 font-semibold">Ventas: {currency}{b.ventas.toFixed(2)}</span>
                  <span className="text-red-500 font-semibold">Gastos: {currency}{b.gastos.toFixed(2)}</span>
                  <span className={`font-semibold ${b.ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>Ganancia: {currency}{b.ganancia.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 border-b"><h2 className="font-semibold">🧾 Últimas Ventas</h2></div>
        {recentSales.length === 0 ? (
          <div className="p-4 text-center text-gray-400 py-8">No hay ventas aún</div>
        ) : (
          <div className="divide-y">
            {recentSales.map((s) => (
              <div key={s.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{currency}{Number(s.total).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{s.payment_method || 'N/A'}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
