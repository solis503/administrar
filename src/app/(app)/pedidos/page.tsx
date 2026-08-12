'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBranch } from '@/lib/branch-context'
import { useBusiness } from '@/lib/business-context'

export default function PedidosPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [branches, setBranches] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirmCancel, setConfirmCancel] = useState<any>(null)
  const [cancelling, setCancelling] = useState(false)

  const [finalizing, setFinalizing] = useState<any>(null)
  const [finalizeItems, setFinalizeItems] = useState<any[]>([])
  const [shiftForOrder, setShiftForOrder] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [amountPaid, setAmountPaid] = useState('')
  const [isMixedPayment, setIsMixedPayment] = useState(false)
  const [mixedAmounts, setMixedAmounts] = useState({ efectivo: '', tarjeta: '', transferencia: '' })
  const [finalizeError, setFinalizeError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()
  const { business, loading: businessLoading } = useBusiness()
  const { selectedBranchId } = useBranch()

  useEffect(() => {
    if (business) loadData()
    else if (!businessLoading) setLoading(false)
  }, [business, selectedBranchId])

  const loadData = async () => {
    if (!business) return
    setLoading(true)

    let ordersQuery = supabase.from('open_orders').select('*').eq('business_id', business.id).eq('status', 'pendiente').order('created_at', { ascending: true })
    if (selectedBranchId) ordersQuery = ordersQuery.eq('branch_id', selectedBranchId)

    const [{ data: brs }, { data: ordersData }] = await Promise.all([
      supabase.from('branches').select('id, name').eq('business_id', business.id),
      ordersQuery,
    ])
    setBranches(Object.fromEntries((brs || []).map((b: any) => [b.id, b.name])))

    const orderIds = (ordersData || []).map((o: any) => o.id)
    let items: any[] = []
    if (orderIds.length > 0) {
      const { data: itemsData } = await supabase.from('open_order_items').select('*').in('open_order_id', orderIds)
      items = itemsData || []
    }

    setOrders((ordersData || []).map((o: any) => ({ ...o, items: items.filter(i => i.open_order_id === o.id) })))
    setLoading(false)
  }

  const openCancelConfirm = (order: any) => setConfirmCancel(order)

  const confirmCancelOrder = async () => {
    if (!confirmCancel) return
    setCancelling(true)
    await supabase.from('open_orders').update({ status: 'cancelado' }).eq('id', confirmCancel.id)
    setCancelling(false)
    setConfirmCancel(null)
    loadData()
  }

  const openFinalize = async (order: any) => {
    setFinalizeError('')
    setPaymentMethod('efectivo')
    setAmountPaid(Number(order.total).toFixed(2))
    setIsMixedPayment(false)
    setMixedAmounts({ efectivo: '', tarjeta: '', transferencia: '' })

    const [{ data: items }, { data: shift }] = await Promise.all([
      supabase.from('open_order_items').select('*, products(product_type)').eq('open_order_id', order.id),
      supabase
        .from('cash_shifts')
        .select('*')
        .eq('business_id', business.id)
        .eq('branch_id', order.branch_id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setFinalizeItems(items || [])
    setShiftForOrder(shift || null)

    setFinalizing(order)
  }

  const total = finalizing ? Number(finalizing.total) : 0
  const mixedSum = (parseFloat(mixedAmounts.efectivo) || 0) + (parseFloat(mixedAmounts.tarjeta) || 0) + (parseFloat(mixedAmounts.transferencia) || 0)
  const mixedMatches = Math.abs(mixedSum - total) < 0.01

  const confirmFinalize = async () => {
    if (!finalizing || !business) return
    if (!shiftForOrder) { setFinalizeError('Esa sucursal no tiene un turno de caja abierto. Andá al POS de esa sucursal y abrí turno primero.'); return }
    if (isMixedPayment && !mixedMatches) { setFinalizeError('Los montos del pago mixto no suman el total'); return }

    setSubmitting(true)
    setFinalizeError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No se pudo confirmar tu sesión')

      let payments: { method: string; amount: number }[] = []
      let paid = 0
      let change = 0

      if (isMixedPayment) {
        payments = [
          { method: 'efectivo', amount: parseFloat(mixedAmounts.efectivo) || 0 },
          { method: 'tarjeta', amount: parseFloat(mixedAmounts.tarjeta) || 0 },
          { method: 'transferencia', amount: parseFloat(mixedAmounts.transferencia) || 0 },
        ].filter(p => p.amount > 0)
        paid = mixedSum
      } else {
        paid = parseFloat(amountPaid) || total
        change = paymentMethod === 'efectivo' ? Math.max(0, paid - total) : 0
        payments = [{ method: paymentMethod, amount: total }]
      }

      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        business_id: business.id,
        branch_id: finalizing.branch_id,
        shift_id: shiftForOrder.id,
        user_id: user.id,
        total,
        tax_amount: finalizing.tax_amount,
        payment_method: isMixedPayment ? 'mixto' : paymentMethod,
        amount_paid: paid,
        change_amount: change,
        status: 'completada',
      }).select().single()

      if (saleErr || !sale) throw new Error(saleErr?.message || 'No se pudo registrar la venta')

      const paymentInserts = payments.map(p =>
        supabase.from('sale_payments').insert({ sale_id: sale.id, method: p.method, amount: p.amount })
      )

      const itemInserts = finalizeItems.map(async (item) => {
        const { error: itemErr } = await supabase.from('sale_items').insert({
          sale_id: sale.id,
          product_id: item.is_custom ? null : item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.unit_price * item.quantity,
          cost: item.is_custom ? (item.cost || 0) : 0,
          is_custom: !!item.is_custom,
        })
        if (itemErr) throw new Error(`No se pudo guardar "${item.product_name}": ${itemErr.message}`)

        if (!item.is_custom && item.product_id) {
          if (item.products?.product_type === 'receta') {
            await supabase.rpc('decrement_recipe', { p_product_id: item.product_id, p_multiplier: item.quantity })
          } else {
            await supabase.rpc('decrement_stock', { p_product_id: item.product_id, p_quantity: item.quantity })
          }
        }
      })

      await Promise.all([...paymentInserts, ...itemInserts])

      await supabase.from('open_orders').update({
        status: 'finalizado',
        sale_id: sale.id,
        finalized_at: new Date().toISOString(),
      }).eq('id', finalizing.id)

      setFinalizing(null)
      loadData()
    } catch (err: any) {
      setFinalizeError(err.message || 'No se pudo finalizar el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const curr = business?.currency_symbol || '$'

  if (businessLoading || loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🧾 Pedidos Pendientes</h1>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3">🧾</p>
          <p className="text-gray-500">No hay cuentas ni pedidos pendientes ahorita.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${o.order_type === 'cuenta' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                    {o.order_type === 'cuenta' ? '🍽️ Cuenta en mesa' : '📞 Pedido a recoger'}
                  </span>
                  <p className="font-bold mt-1">{o.customer_name}</p>
                  {!selectedBranchId && <p className="text-xs text-gray-400">{branches[o.branch_id] || ''}</p>}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(o.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  {o.pickup_time && <> · Recoger {new Date(o.pickup_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</>}
                </span>
              </div>
              <div className="space-y-0.5 mb-2 text-sm text-gray-600">
                {o.items.map((it: any) => (
                  <p key={it.id}>{it.quantity} x {it.product_name}</p>
                ))}
              </div>
              {o.notes && <p className="text-xs text-gray-500 italic mb-2">📝 {o.notes}</p>}
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-bold">{curr}{Number(o.total).toFixed(2)}</span>
                <div className="flex gap-2">
                  <button onClick={() => openCancelConfirm(o)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Cancelar</button>
                  <button onClick={() => openFinalize(o)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold">✅ Finalizar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <h2 className="text-lg font-bold mb-1">¿Cancelar el pedido de "{confirmCancel.customer_name}"?</h2>
            <p className="text-sm text-gray-500 mb-5">No se registra ninguna venta, es como si nunca hubiera pasado. Esto no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={confirmCancelOrder} disabled={cancelling} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50">
                {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
              <button onClick={() => setConfirmCancel(null)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Volver</button>
            </div>
          </div>
        </div>
      )}

      {finalizing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-1">✅ Finalizar pedido</h2>
            <p className="text-sm text-gray-500 mb-4">{finalizing.customer_name} · {curr}{total.toFixed(2)}</p>

            {!shiftForOrder ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-3 rounded-lg text-sm mb-3">
                Esa sucursal no tiene un turno de caja abierto ahorita. Andá al POS de esa sucursal y abrí turno primero, después volvé acá a finalizar.
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-700">Forma de pago</span>
                  <button
                    onClick={() => setIsMixedPayment(!isMixedPayment)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${isMixedPayment ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-600'}`}
                  >
                    🔀 Pago mixto
                  </button>
                </div>

                {!isMixedPayment ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[{ v: 'efectivo', l: '💵 Efectivo' }, { v: 'tarjeta', l: '💳 Tarjeta' }, { v: 'transferencia', l: '🏦 Transfer.' }].map(m => (
                        <button key={m.v} onClick={() => setPaymentMethod(m.v)} className={`py-2.5 rounded-xl border-2 font-semibold text-sm ${paymentMethod === m.v ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>{m.l}</button>
                      ))}
                    </div>
                    {paymentMethod === 'efectivo' && (
                      <div className="mb-3">
                        <label className="text-sm font-medium block mb-1">¿Cuánto entrega el cliente?</label>
                        <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-lg" />
                        {parseFloat(amountPaid) >= total && <p className="text-green-600 font-semibold mt-1">Vuelto: {curr}{(parseFloat(amountPaid) - total).toFixed(2)}</p>}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3 mb-3">
                    <div>
                      <label className="text-sm font-medium block mb-1">💵 Efectivo</label>
                      <input type="number" value={mixedAmounts.efectivo} onChange={e => setMixedAmounts({ ...mixedAmounts, efectivo: e.target.value })} className="w-full px-4 py-3 rounded-xl border" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">💳 Tarjeta</label>
                      <input type="number" value={mixedAmounts.tarjeta} onChange={e => setMixedAmounts({ ...mixedAmounts, tarjeta: e.target.value })} className="w-full px-4 py-3 rounded-xl border" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">🏦 Transferencia</label>
                      <input type="number" value={mixedAmounts.transferencia} onChange={e => setMixedAmounts({ ...mixedAmounts, transferencia: e.target.value })} className="w-full px-4 py-3 rounded-xl border" placeholder="0.00" />
                    </div>
                    <p className={`text-sm font-semibold ${mixedMatches ? 'text-green-600' : 'text-red-500'}`}>
                      Suma: {curr}{mixedSum.toFixed(2)} {mixedMatches ? '✓ Coincide' : `(falta ${curr}${(total - mixedSum).toFixed(2)})`}
                    </p>
                  </div>
                )}
              </>
            )}

            {finalizeError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{finalizeError}</div>}

            <div className="flex gap-3 mt-4">
              <button onClick={confirmFinalize} disabled={submitting || !shiftForOrder || (isMixedPayment && !mixedMatches)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-50">
                {submitting ? 'Procesando...' : '✓ Confirmar cobro'}
              </button>
              <button onClick={() => setFinalizing(null)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
