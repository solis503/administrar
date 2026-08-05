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
  const [lowStock, setLowStock] = useState<any[]>([])
  const [recentSales, setRecentSales] = useState<any[]>([])
  const supabase = createClient()
  const { selectedBranchId, branches, canSwitchBranches } = useBranch()

  useEffect(() => { loadData() }, [selectedBranchId])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

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
    let productsQuery = supabase.from('products').select('id, name, stock, min_stock, unit').eq('business_id', biz.id)
    let recentSalesQuery = supabase.from('sales').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(5)

    if (selectedBranchId) {
      salesQuery = salesQuery.eq('branch_id', selectedBranchId)
      expensesQuery = expensesQuery.eq('branch_id', selectedBranchId)
      productsQuery = productsQuery.eq('branch_id', selectedBranchId)
      recentSalesQuery = recentSalesQuery.eq('branch_id', selectedBranchId)
    }

    const [salesRes, expensesRes, productsRes, recentSalesRes] = await Promise.all([
      salesQuery, expensesQuery, productsQuery, recentSalesQuery,
    ])

    setSalesToday(salesRes.data || [])
    setExpensesToday(expensesRes.data || [])
    setRecentSales(recentSalesRes.data || [])

    const todaySaleIds = (salesRes.data || []).map((s: any) => s.id)
    let items: any[] = []
    if (todaySaleIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, quantity')
        .in('sale_id', todaySaleIds)
      items = itemsData || []
    }
    setSaleItemsToday(items)
    const costMapResult = await getProductCostMap(supabase, biz.id)
    setCostMap(costMapResult)
    setCogsToday(calculateCOGS(items, costMapResult))

    const allProducts = productsRes.data || []
    setLowStock(
      allProducts
        .filter((p: any) => p.min_stock != null && Number(p.stock) <= Number(p.min_stock))
        .sort((a: any, b: any) => Number(a.stock) - Number(b.stock))
        .slice(0, 5)
    )

    setLoading(false)
  }

  const currency = business?.currency_symbol || '$'
  const totalVentasHoy = salesToday.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const totalGastosHoy = expensesToday.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const ganancia = totalVentasHoy - cogsToday - totalGastosHoy

  // Cuando el dueño está viendo "Todas las sucursales", armamos el desglose por sucursal
  const showBranchBreakdown = canSwitchBranches && !selectedBranchId && branches.length > 1
  const saleBranchMap: Record<string, string> = {}
  salesToday.forEach((s) => { saleBranchMap[s.id] = s.branch_id })
  const branchBreakdown = branches.map((b) => {
    const ventas = salesToday.filter((s) => s.branch_id === b.id).reduce((sum, s) => sum + Number(s.total || 0), 0)
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Alertas Stock</p>
          <p className="text-3xl font-bold text-amber-600">{lowStock.length}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b"><h2 className="font-semibold">⚠️ Stock Bajo</h2></div>
          {lowStock.length === 0 ? (
            <div className="p-4 text-center text-gray-400 py-8">Sin alertas de stock</div>
          ) : (
            <div className="divide-y">
              {lowStock.map((p) => (
                <div key={p.id} className="p-4 flex justify-between items-center">
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-sm text-amber-600 font-semibold">
                    {p.stock} {p.unit} <span className="text-gray-400 font-normal">/ mín {p.min_stock}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

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
    </div>
  )
}
