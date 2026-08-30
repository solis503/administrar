'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import * as XLSX from 'xlsx'
import { useBranch } from '@/lib/branch-context'
import { useBusiness } from '@/lib/business-context'
import { getProductCostMap, calculateCOGS } from '@/lib/cogs'
import SaleDetailModal from '@/components/SaleDetailModal'

type Period = 'today' | 'week' | 'month' | 'custom'
const STREAK_THRESHOLD = 4 // días con ventas que hay que registrar en la semana para mantener la racha

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [closerNames, setCloserNames] = useState<Record<string, string>>({})
  const [cogs, setCogs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [tab, setTab] = useState<'resumen' | 'cantidades' | 'turnos'>('resumen')
  const [streakWeeks, setStreakWeeks] = useState(0)
  const [currentWeekDays, setCurrentWeekDays] = useState<boolean[]>([false, false, false, false, false, false, false])
  const supabase = createClient()
  const { business, isOwner, loading: businessLoading } = useBusiness()
  const { selectedBranchId, branches } = useBranch()

  useEffect(() => {
    if (business) loadData()
    else if (!businessLoading) setLoading(false)
  }, [business, period, customFrom, customTo, selectedBranchId])

  useEffect(() => {
    if (business) loadStreak()
  }, [business, selectedBranchId])

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
      since = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), now.getDate())
      until = customTo ? new Date(customTo + 'T23:59:59.999') : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    }
    return { since, until }
  }

  const loadData = async () => {
    if (!business) return
    setLoading(true)

    const { since, until } = getDateRange()

    let salesQuery = supabase.from('sales').select('*').eq('business_id', business.id)
      .gte('created_at', since.toISOString()).lte('created_at', until.toISOString())
      .order('created_at', { ascending: false })
    let expensesQuery = supabase.from('expenses').select('*').eq('business_id', business.id)
      .gte('created_at', since.toISOString()).lte('created_at', until.toISOString())
    let shiftsQuery = supabase.from('cash_shifts').select('*').eq('business_id', business.id).eq('status', 'closed')
      .gte('closed_at', since.toISOString()).lte('closed_at', until.toISOString())
      .order('closed_at', { ascending: false })
    let profilesQuery = supabase.from('profiles').select('user_id, full_name, email').eq('business_id', business.id)

    if (selectedBranchId) {
      salesQuery = salesQuery.eq('branch_id', selectedBranchId)
      expensesQuery = expensesQuery.eq('branch_id', selectedBranchId)
      shiftsQuery = shiftsQuery.eq('branch_id', selectedBranchId)
    }

    const [salesRes, expensesRes, shiftsRes, profilesRes] = await Promise.all([salesQuery, expensesQuery, shiftsQuery, profilesQuery])
    const salesData = salesRes.data || []
    setSales(salesData)
    setExpenses(expensesRes.data || [])
    setShifts(shiftsRes.data || [])

    const namesMap: Record<string, string> = {}
    ;(profilesRes.data || []).forEach((p: any) => { namesMap[p.user_id] = p.full_name || p.email || '—' })
    if (business.owner_id) namesMap[business.owner_id] = namesMap[business.owner_id] || 'Dueño'
    setCloserNames(namesMap)

    const activeSales = salesData.filter((s: any) => s.status !== 'anulada')
    const saleIds = activeSales.map((s: any) => s.id)
    let items: any[] = []
    if (saleIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('sale_id, product_id, product_name, quantity, unit_price, subtotal, cost, returned_quantity')
        .in('sale_id', saleIds)
      items = itemsData || []
    }
    setSaleItems(items)

    const costMap = await getProductCostMap(supabase, business.id)
    const itemsForCogs = items.map((it: any) => ({ ...it, quantity: Number(it.quantity) - Number(it.returned_quantity || 0) }))
    setCogs(calculateCOGS(itemsForCogs, costMap))

    setLoading(false)
  }

  // ---------- Racha semanal (independiente del período elegido arriba) ----------
  const mondayOf = (d: Date) => {
    const x = new Date(d)
    const day = x.getDay()
    const diff = day === 0 ? -6 : 1 - day
    x.setDate(x.getDate() + diff)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const dateKey = (d: Date) => d.toISOString().split('T')[0]

  const loadStreak = async () => {
    if (!business) return
    const since = new Date()
    since.setDate(since.getDate() - 7 * 30) // ~30 semanas hacia atrás alcanza de sobra

    let q = supabase.from('sales').select('created_at').eq('business_id', business.id).eq('status', 'completada').gte('created_at', since.toISOString())
    if (selectedBranchId) q = q.eq('branch_id', selectedBranchId)
    const { data } = await q

    const activeDates = new Set((data || []).map((s: any) => dateKey(new Date(s.created_at))))

    const today = new Date()
    const currentMonday = mondayOf(today)

    const curDays: boolean[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday)
      d.setDate(d.getDate() + i)
      curDays.push(d <= today && activeDates.has(dateKey(d)))
    }
    setCurrentWeekDays(curDays)
    const currentWeekActiveDays = curDays.filter(Boolean).length

    let streak = 0
    const weekStart = new Date(currentMonday)
    weekStart.setDate(weekStart.getDate() - 7)
    for (let w = 0; w < 52; w++) {
      let activeDays = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        if (activeDates.has(dateKey(d))) activeDays++
      }
      if (activeDays >= STREAK_THRESHOLD) {
        streak++
        weekStart.setDate(weekStart.getDate() - 7)
      } else break
    }
    if (currentWeekActiveDays >= STREAK_THRESHOLD) streak++
    setStreakWeeks(streak)
  }

  const activeSales = sales.filter(s => s.status !== 'anulada')
  const totalRefunds = activeSales.reduce((s, v) => s + Number(v.refunded_total || 0), 0)
  const totalSales = activeSales.reduce((s, v) => s + Number(v.total), 0) - totalRefunds
  const totalExp = expenses.reduce((s, v) => s + Number(v.amount), 0)
  const gananciaBruta = totalSales - cogs
  const balance = gananciaBruta - totalExp
  const egresos = totalExp + cogs
  const curr = business?.currency_symbol || '$'
  const branchNameMap: Record<string, string> = Object.fromEntries(branches.map((b: any) => [b.id, b.name]))

  const byMethod: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0, mixto: 0 }
  activeSales.forEach(s => { byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total) })

  const prodCount: Record<string, number> = {}
  const prodRevenue: Record<string, number> = {}
  saleItems.forEach(p => {
    const netQty = Number(p.quantity) - Number(p.returned_quantity || 0)
    prodCount[p.product_name] = (prodCount[p.product_name] || 0) + netQty
    prodRevenue[p.product_name] = (prodRevenue[p.product_name] || 0) + netQty * Number(p.unit_price)
  })
  const topProds: [string, number][] = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxProd: number = topProds.length ? topProds[0][1] : 1
  const allProdsSold = Object.entries(prodCount)
    .map(([name, qty]) => ({ name, qty, revenue: prodRevenue[name] || 0 }))
    .sort((a, b) => b.qty - a.qty)

  const saleDateMap: Record<string, string> = {}
  sales.forEach(s => { saleDateMap[s.id] = s.created_at })

  const saleItemsDetail = saleItems
    .map(it => ({
      date: saleDateMap[it.sale_id],
      saleId: it.sale_id,
      name: it.product_name,
      qty: Number(it.quantity) - Number(it.returned_quantity || 0),
      unitPrice: Number(it.unit_price),
      subtotal: (Number(it.quantity) - Number(it.returned_quantity || 0)) * Number(it.unit_price),
    }))
    .filter(it => it.qty > 0 && it.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const totalDiferencias = shifts.reduce((s, sh) => s + Number(sh.difference || 0), 0)

  const getPeriodLabel = () => {
    if (period === 'today') return 'Hoy'
    if (period === 'week') return 'Última semana'
    if (period === 'month') return 'Este mes'
    return `${customFrom || 'inicio'} al ${customTo || 'hoy'}`
  }

  // Últimos días para la franja tipo "27 · 28 · 29 · 30 ago"
  const dayStrip = Array.from({ length: 4 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (3 - i))
    return d
  })
  const isDaySelected = (d: Date) => period === 'custom' && customFrom === dateKey(d) && customTo === dateKey(d)
  const selectDay = (d: Date) => {
    setPeriod('custom')
    setCustomFrom(dateKey(d))
    setCustomTo(dateKey(d))
    setShowDatePicker(false)
  }

  // ---------- Exportar a Excel (archivo .xlsx real, se descarga directo) ----------
  const exportExcel = () => {
    const rows = sales.map(s => ({
      Fecha: new Date(s.created_at).toLocaleString('es'),
      Total: Number(s.total),
      Método: s.payment_method,
      Estado: s.status === 'anulada' ? 'Anulada' : (Number(s.refunded_total) > 0 ? 'Con devolución' : 'OK'),
      Devuelto: Number(s.refunded_total || 0),
    }))

    const wb = XLSX.utils.book_new()
    const wsVentas = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas')

    const wsDetalle = XLSX.utils.json_to_sheet(
      saleItemsDetail.map(it => ({
        'Fecha y hora': new Date(it.date).toLocaleString('es'),
        Producto: it.name,
        Cantidad: it.qty,
        'Precio Unitario': it.unitPrice,
        Subtotal: it.subtotal,
      }))
    )
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle por Venta')

    const wsTurnos = XLSX.utils.json_to_sheet(
      shifts.map(sh => ({
        Sucursal: branchNameMap[sh.branch_id] || '—',
        Apertura: new Date(sh.opened_at).toLocaleString('es'),
        Cierre: sh.closed_at ? new Date(sh.closed_at).toLocaleString('es') : '—',
        'Efectivo Inicial': Number(sh.opening_amount),
        Esperado: Number(sh.expected_amount || 0),
        Contado: Number(sh.closing_amount || 0),
        Diferencia: Number(sh.difference || 0),
        'Cerrado por': closerNames[sh.closed_by] || '—',
      }))
    )
    XLSX.utils.book_append_sheet(wb, wsTurnos, 'Turnos de Caja')

    const wsResumen = XLSX.utils.json_to_sheet([
      { Concepto: 'Período', Valor: getPeriodLabel() },
      { Concepto: 'Ingresos', Valor: totalSales },
      { Concepto: 'Egresos (costo + gastos)', Valor: egresos },
      { Concepto: 'Balance', Valor: balance },
      { Concepto: 'Costo de Productos', Valor: cogs },
      { Concepto: 'Gastos', Valor: totalExp },
      { Concepto: 'Transacciones', Valor: activeSales.length },
      { Concepto: 'Diferencia total en turnos de caja', Valor: totalDiferencias },
    ])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    if (allProdsSold.length > 0) {
      const wsProductos = XLSX.utils.json_to_sheet(
        allProdsSold.map(p => ({ Producto: p.name, 'Cantidad Total': p.qty, 'Total Generado': p.revenue }))
      )
      XLSX.utils.book_append_sheet(wb, wsProductos, 'Cantidades Totales')
    }

    XLSX.writeFile(wb, `Reporte-${getPeriodLabel().replace(/\s+/g, '-')}.xlsx`)
  }

  // ---------- Exportar a PDF (abre una ventana lista para "Guardar como PDF") ----------
  const exportPDF = () => {
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) {
      alert('Tu navegador bloqueó la ventana. Permití las ventanas emergentes para poder exportar a PDF.')
      return
    }
    const rowsHtml = sales.map(s => `<tr>
      <td>${new Date(s.created_at).toLocaleString('es')}</td>
      <td style="text-align:right">${curr}${Number(s.total).toFixed(2)}</td>
      <td>${s.payment_method}</td>
      <td>${s.status === 'anulada' ? 'Anulada' : (Number(s.refunded_total) > 0 ? 'Con devolución' : 'OK')}</td>
    </tr>`).join('')

    const detailRowsHtml = saleItemsDetail.map(it => `<tr>
      <td>${new Date(it.date).toLocaleString('es')}</td>
      <td>${it.name}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${curr}${it.unitPrice.toFixed(2)}</td>
      <td style="text-align:right">${curr}${it.subtotal.toFixed(2)}</td>
    </tr>`).join('')

    const shiftsRowsHtml = shifts.map(sh => `<tr>
      <td>${branchNameMap[sh.branch_id] || '—'}</td>
      <td>${new Date(sh.opened_at).toLocaleString('es')}</td>
      <td>${sh.closed_at ? new Date(sh.closed_at).toLocaleString('es') : '—'}</td>
      <td style="text-align:right">${curr}${Number(sh.opening_amount).toFixed(2)}</td>
      <td style="text-align:right">${curr}${Number(sh.expected_amount || 0).toFixed(2)}</td>
      <td style="text-align:right">${curr}${Number(sh.closing_amount || 0).toFixed(2)}</td>
      <td style="text-align:right;color:${Number(sh.difference || 0) === 0 ? '#111' : (Number(sh.difference || 0) > 0 ? '#2563eb' : '#dc2626')}">${curr}${Number(sh.difference || 0).toFixed(2)}</td>
      <td>${closerNames[sh.closed_by] || '—'}</td>
    </tr>`).join('')

    win.document.write(`<html><head><title>Reporte - ${getPeriodLabel()}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin-bottom:2px}
      h2{font-size:15px;margin-top:28px;margin-bottom:4px}
      p.sub{color:#666;margin-top:0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{padding:8px;border-bottom:1px solid #eee;font-size:12px;text-align:left}
      th{background:#f5f5f5}
      .summary{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap}
      .card{border:1px solid #eee;border-radius:8px;padding:10px 16px}
      .card p{margin:0;font-size:11px;color:#888}
      .card strong{font-size:16px;color:#111}
      @media print { h2 { page-break-before: auto; } }
    </style></head><body>
      <h1>${business?.name || 'Reporte'}</h1>
      <p class="sub">Reporte de ventas · ${getPeriodLabel()}</p>
      <div class="summary">
        <div class="card"><p>Ingresos</p><strong>${curr}${totalSales.toFixed(2)}</strong></div>
        <div class="card"><p>Egresos</p><strong>${curr}${egresos.toFixed(2)}</strong></div>
        <div class="card"><p>Balance</p><strong>${curr}${balance.toFixed(2)}</strong></div>
      </div>

      <h2>🧾 Ventas registradas</h2>
      <table><thead><tr><th>Fecha</th><th>Total</th><th>Método</th><th>Estado</th></tr></thead><tbody>${rowsHtml}</tbody></table>

      <h2>📦 Detalle: qué se vendió en cada venta</h2>
      <table><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Cantidad</th><th>Precio Unitario</th><th>Subtotal</th></tr></thead><tbody>${detailRowsHtml}</tbody></table>

      <h2>🧮 Turnos de Caja</h2>
      <table><thead><tr><th>Sucursal</th><th>Apertura</th><th>Cierre</th><th>Inicial</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Cerrado por</th></tr></thead><tbody>${shiftsRowsHtml}</tbody></table>
    </body></html>`)
    win.document.close()
    win.print()
  }

  if (businessLoading || loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  const weekdayLetters = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">📈 Reportes</h1>

      {/* Vistas amplias */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {([['week', 'Semana'], ['month', 'Mes']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${period === v ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {/* Franja de días, estilo "27 · 28 · 29 · 30" */}
      <div className="bg-primary-600 rounded-2xl p-3 mb-4 flex items-center gap-2 overflow-x-auto">
        {dayStrip.map((d, i) => {
          const isToday = i === dayStrip.length - 1
          const selected = isDaySelected(d)
          return (
            <button
              key={i}
              onClick={() => selectDay(d)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${selected ? 'bg-white text-primary-700' : 'text-white/90 hover:bg-white/10'}`}
            >
              {d.toLocaleDateString('es', { day: '2-digit', month: 'short' })}{isToday && !selected ? ' · Hoy' : ''}
            </button>
          )
        })}
        <div className="w-px h-6 bg-white/30 flex-shrink-0" />
        <button onClick={() => { setPeriod('custom'); setShowDatePicker(!showDatePicker) }} className="flex-shrink-0 text-white text-lg px-2">📅</button>
      </div>

      {period === 'custom' && showDatePicker && (
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

      {/* Tarjeta de Balance */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
        <div className="flex justify-between items-center mb-5">
          <span className="text-sm font-medium text-gray-500">Balance · {getPeriodLabel()}</span>
          <span className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{curr}{balance.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1">↗️ Ingresos</p>
            <p className="text-xl font-bold text-green-600">{curr}{totalSales.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1">↘️ Egresos</p>
            <p className="text-xl font-bold text-red-500">{curr}{egresos.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-center border-t pt-4 text-sm">
          <div className="flex gap-3">
            <button onClick={exportExcel} disabled={sales.length === 0} className="font-semibold text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed">📊 Excel</button>
            <button onClick={exportPDF} disabled={sales.length === 0} className="font-semibold text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed">📄 PDF</button>
          </div>
          <button onClick={() => setTab('turnos')} className="font-semibold text-primary-700">🧮 Turnos de Caja ›</button>
        </div>
      </div>

      {/* Racha semanal */}
      <div className="bg-white border-2 border-primary-200 rounded-2xl p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🔥</span>
          <div className="bg-orange-100 text-orange-700 font-bold text-sm px-3 py-1 rounded-full">{streakWeeks} {streakWeeks === 1 ? 'semana' : 'semanas'}</div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="flex gap-1.5 mb-1">
            {currentWeekDays.map((active, i) => (
              <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {weekdayLetters[i]}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Registrá ventas en al menos <strong>{STREAK_THRESHOLD} días</strong> de esta semana para mantener tu racha
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('resumen')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'resumen' ? 'bg-gray-900 text-white' : 'bg-white border hover:bg-gray-50'}`}>📊 Resumen</button>
        <button onClick={() => setTab('cantidades')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'cantidades' ? 'bg-gray-900 text-white' : 'bg-white border hover:bg-gray-50'}`}>📦 Cantidades Vendidas</button>
        <button onClick={() => setTab('turnos')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'turnos' ? 'bg-gray-900 text-white' : 'bg-white border hover:bg-gray-50'}`}>🧮 Turnos de Caja</button>
      </div>

      {tab === 'cantidades' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">📦 Cuánto se vendió de cada producto</h2>
          {allProdsSold.length === 0 ? (
            <p className="text-gray-400 text-center text-sm py-8">Sin ventas en este período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Producto</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Cantidad vendida</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Total generado</th>
                </tr></thead>
                <tbody className="divide-y">
                  {allProdsSold.map((p) => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">{p.qty}</span></td>
                      <td className="px-3 py-2 font-semibold">{curr}{p.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'turnos' && (
        <div>
          {shifts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Turnos cerrados</p><p className="text-2xl font-bold">{shifts.length}</p></div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Cuadraron perfecto</p><p className="text-2xl font-bold text-green-600">{shifts.filter(s => Math.abs(Number(s.difference || 0)) < 0.01).length}</p></div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Diferencia acumulada</p><p className={`text-2xl font-bold ${totalDiferencias === 0 ? 'text-gray-700' : totalDiferencias > 0 ? 'text-blue-600' : 'text-red-600'}`}>{curr}{totalDiferencias.toFixed(2)}</p></div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="font-semibold mb-4">🧮 Historial de Turnos de Caja</h2>
            {shifts.length === 0 ? (
              <p className="text-gray-400 text-center text-sm py-8">No hay turnos cerrados en este período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50 border-b"><tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Sucursal</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Cierre</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Inicial</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Esperado</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Contado</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Diferencia</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Cerrado por</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {shifts.map(sh => {
                      const diff = Number(sh.difference || 0)
                      return (
                        <tr key={sh.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{branchNameMap[sh.branch_id] || '—'}</td>
                          <td className="px-3 py-2">{sh.closed_at ? new Date(sh.closed_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-3 py-2">{curr}{Number(sh.opening_amount).toFixed(2)}</td>
                          <td className="px-3 py-2">{curr}{Number(sh.expected_amount || 0).toFixed(2)}</td>
                          <td className="px-3 py-2">{curr}{Number(sh.closing_amount || 0).toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${Math.abs(diff) < 0.01 ? 'bg-green-100 text-green-700' : diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {diff > 0 ? '+' : ''}{curr}{diff.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{closerNames[sh.closed_by] || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'resumen' && (
      <>

      {totalRefunds > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3 text-sm text-orange-700 font-semibold">
          ↩️ Devoluciones en este período: {curr}{totalRefunds.toFixed(2)} (ya restado del total de ventas)
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Transacciones</p><p className="text-2xl font-bold">{activeSales.length}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Costo de Productos</p><p className="text-2xl font-bold text-orange-500">{curr}{cogs.toFixed(2)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Gastos</p><p className="text-2xl font-bold text-red-500">{curr}{totalExp.toFixed(2)}</p></div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-xs text-gray-500">Ganancia Bruta</p><p className={`text-2xl font-bold ${gananciaBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{curr}{gananciaBruta.toFixed(2)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">💳 Ventas por Método</h2>
          <div className="space-y-3">
            {Object.entries(byMethod).filter(([, v]) => v > 0 || true).map(([m, v]) => {
              const pct = totalSales > 0 ? (v / totalSales * 100) : 0
              const colors: any = { efectivo: 'bg-green-500', tarjeta: 'bg-blue-500', transferencia: 'bg-purple-500', mixto: 'bg-gray-500' }
              const labels: any = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', mixto: '🔀 Mixto' }
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
        <h2 className="font-semibold mb-4">🧾 Detalle de Ventas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Fecha</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Total</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Método</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Estado</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500"></th>
            </tr></thead>
            <tbody className="divide-y">
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{new Date(s.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2 font-semibold">{curr}{Number(s.total).toFixed(2)}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.payment_method === 'efectivo' ? 'bg-green-100 text-green-700' : s.payment_method === 'tarjeta' ? 'bg-blue-100 text-blue-700' : s.payment_method === 'mixto' ? 'bg-gray-200 text-gray-700' : 'bg-purple-100 text-purple-700'}`}>{s.payment_method}</span></td>
                  <td className="px-3 py-2">
                    {s.status === 'anulada' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Anulada</span>
                    ) : Number(s.refunded_total) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Con devolución</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">OK</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setSelectedSale(s)} className="text-primary-600 text-xs font-semibold">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sales.length === 0 && <p className="text-center text-gray-400 py-8">No hay ventas en este rango de fechas</p>}
      </div>
      </>
      )}

      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          isOwner={isOwner}
          currency={curr}
          onClose={() => setSelectedSale(null)}
          onChanged={loadData}
        />
      )}
    </div>
  )
                }
