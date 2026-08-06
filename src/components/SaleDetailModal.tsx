'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function SaleDetailModal({
  sale,
  isOwner,
  currency,
  onClose,
  onChanged,
}: {
  sale: any
  isOwner: boolean
  currency: string
  onClose: () => void
  onChanged: () => void
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'view' | 'return' | 'void' | 'delete'>('view')
  const supabase = createClient()

  useEffect(() => { loadItems() }, [sale.id])

  const loadItems = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sale_items')
      .select('id, product_id, product_name, quantity, unit_price, subtotal, cost, is_custom, returned_quantity')
      .eq('sale_id', sale.id)
    const rows = data || []

    const productIds = rows.map(r => r.product_id).filter(Boolean)
    let typeMap: Record<string, string> = {}
    if (productIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id, product_type').in('id', productIds)
      typeMap = Object.fromEntries((prods || []).map(p => [p.id, p.product_type]))
    }

    setItems(rows.map(r => ({ ...r, product_type: r.product_id ? typeMap[r.product_id] : null })))
    setLoading(false)
  }

  const restoreStock = async (item: any, quantity: number) => {
    if (!item.product_id) return // venta libre, no hay inventario que restaurar
    if (item.product_type === 'receta') {
      await supabase.rpc('increment_recipe', { p_product_id: item.product_id, p_multiplier: quantity })
    } else {
      await supabase.rpc('increment_stock', { p_product_id: item.product_id, p_quantity: quantity })
    }
  }

  const handleVoid = async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setProcessing(true)
    try {
      for (const item of items) {
        const pending = Number(item.quantity) - Number(item.returned_quantity)
        if (pending > 0) await restoreStock(item, pending)
      }
      const { error: updErr } = await supabase.from('sales').update({
        status: 'anulada',
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        void_reason: reason || null,
      }).eq('id', sale.id)
      if (updErr) throw updErr
      onChanged()
      onClose()
    } catch (err: any) {
      setError(err.message || 'No se pudo anular la venta')
    } finally {
      setProcessing(false)
    }
  }

  const handleReturn = async () => {
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const lines = items
      .map(item => ({ item, qty: parseFloat(returnQty[item.id] || '0') || 0 }))
      .filter(l => l.qty > 0)

    if (lines.length === 0) { setError('Poné al menos una cantidad a devolver'); return }

    for (const l of lines) {
      const pending = Number(l.item.quantity) - Number(l.item.returned_quantity)
      if (l.qty > pending) { setError(`"${l.item.product_name}" solo tiene ${pending} disponibles para devolver`); return }
    }

    setProcessing(true)
    try {
      const totalAmount = lines.reduce((s, l) => s + l.qty * Number(l.item.unit_price), 0)

      const { data: ret, error: retErr } = await supabase.from('sale_returns').insert({
        sale_id: sale.id,
        business_id: sale.business_id,
        branch_id: sale.branch_id,
        created_by: user.id,
        reason: reason || null,
        total_amount: totalAmount,
      }).select().single()
      if (retErr || !ret) throw retErr || new Error('No se pudo crear la devolución')

      for (const l of lines) {
        await supabase.from('sale_return_items').insert({
          return_id: ret.id,
          sale_item_id: l.item.id,
          quantity: l.qty,
          amount: l.qty * Number(l.item.unit_price),
        })
        await supabase.from('sale_items').update({
          returned_quantity: Number(l.item.returned_quantity) + l.qty,
        }).eq('id', l.item.id)
        await restoreStock(l.item, l.qty)
      }

      await supabase.from('sales').update({
        refunded_total: Number(sale.refunded_total || 0) + totalAmount,
      }).eq('id', sale.id)

      onChanged()
      onClose()
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar la devolución')
    } finally {
      setProcessing(false)
    }
  }

  const handleHardDelete = async () => {
    setError('')
    setProcessing(true)
    try {
      for (const item of items) {
        const pending = Number(item.quantity) - Number(item.returned_quantity)
        if (pending > 0) await restoreStock(item, pending)
      }
      const { error: delErr } = await supabase.from('sales').delete().eq('id', sale.id)
      if (delErr) throw delErr
      onChanged()
      onClose()
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar la venta')
    } finally {
      setProcessing(false)
    }
  }

  const totalReturnAmount = items.reduce((s, item) => {
    const qty = parseFloat(returnQty[item.id] || '0') || 0
    return s + qty * Number(item.unit_price)
  }, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">🧾 Venta</h2>
            <p className="text-sm text-gray-500">
              {new Date(sale.created_at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${sale.status === 'anulada' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {sale.status === 'anulada' ? 'Anulada' : 'Completada'}
          </span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400">Cargando...</div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {items.map(item => {
                const pending = Number(item.quantity) - Number(item.returned_quantity)
                return (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{item.product_name} {item.is_custom && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full ml-1">Libre</span>}</p>
                        <p className="text-xs text-gray-500">{item.quantity} x {currency}{Number(item.unit_price).toFixed(2)} {Number(item.returned_quantity) > 0 && <span className="text-orange-500">· {item.returned_quantity} devueltas</span>}</p>
                      </div>
                      <span className="font-semibold text-sm">{currency}{Number(item.subtotal).toFixed(2)}</span>
                    </div>
                    {isOwner && mode === 'return' && sale.status === 'completada' && pending > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Devolver:</label>
                        <input
                          type="number"
                          min="0"
                          max={pending}
                          value={returnQty[item.id] || ''}
                          onChange={e => setReturnQty({ ...returnQty, [item.id]: e.target.value })}
                          className="w-20 px-2 py-1 rounded border text-sm"
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-400">de {pending} disponibles</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between text-lg font-bold border-t pt-3 mb-2">
              <span>Total</span><span>{currency}{Number(sale.total).toFixed(2)}</span>
            </div>
            {Number(sale.refunded_total) > 0 && (
              <p className="text-sm text-orange-600 font-semibold mb-3">Devuelto hasta ahora: {currency}{Number(sale.refunded_total).toFixed(2)}</p>
            )}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>}

            {!isOwner ? (
              <p className="text-xs text-gray-400 text-center mt-2">Solo el dueño del negocio puede anular, devolver o eliminar ventas.</p>
            ) : mode === 'view' ? (
              <div className="flex flex-col gap-2 mt-4">
                {sale.status === 'completada' && (
                  <div className="flex gap-2">
                    <button onClick={() => setMode('return')} className="flex-1 py-2.5 bg-orange-100 text-orange-700 font-semibold rounded-xl text-sm">↩️ Devolución parcial</button>
                    <button onClick={() => setMode('void')} className="flex-1 py-2.5 bg-red-100 text-red-700 font-semibold rounded-xl text-sm">✕ Anular venta</button>
                  </div>
                )}
                <button onClick={() => setMode('delete')} className="w-full py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm">🗑️ Eliminar venta por completo</button>
              </div>
            ) : mode === 'return' ? (
              <div className="mt-3">
                <label className="text-sm font-medium block mb-1">Motivo <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border mb-3" placeholder="Ej: Producto en mal estado" />
                <p className="text-sm font-semibold mb-3">Se va a devolver: {currency}{totalReturnAmount.toFixed(2)}</p>
                <div className="flex gap-3">
                  <button onClick={handleReturn} disabled={processing || totalReturnAmount <= 0} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl disabled:opacity-50">
                    {processing ? 'Procesando...' : 'Confirmar devolución'}
                  </button>
                  <button onClick={() => setMode('view')} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Volver</button>
                </div>
              </div>
            ) : mode === 'void' ? (
              <div className="mt-3">
                <label className="text-sm font-medium block mb-1">Motivo de la anulación <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border mb-3" placeholder="Ej: Se cobró por error" />
                <p className="text-sm text-gray-500 mb-3">Esto anula la venta completa y devuelve todo el inventario que no se haya devuelto ya.</p>
                <div className="flex gap-3">
                  <button onClick={handleVoid} disabled={processing} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50">
                    {processing ? 'Anulando...' : 'Confirmar anulación'}
                  </button>
                  <button onClick={() => setMode('view')} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Volver</button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-gray-700 font-semibold mb-1">⚠️ Esto borra la venta por completo, para siempre.</p>
                <p className="text-sm text-gray-500 mb-3">A diferencia de "Anular", esta venta desaparece del historial y de tus reportes. Se restaura el inventario que no se haya devuelto ya. Usalo solo para ventas hechas por error (ej. pruebas o cobros duplicados).</p>
                <div className="flex gap-3">
                  <button onClick={handleHardDelete} disabled={processing} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50">
                    {processing ? 'Eliminando...' : 'Sí, eliminar para siempre'}
                  </button>
                  <button onClick={() => setMode('view')} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Volver</button>
                </div>
              </div>
            )}
          </>
        )}

        <button onClick={onClose} className="w-full mt-4 py-2 text-gray-400 text-sm font-semibold">Cerrar</button>
      </div>
    </div>
  )
}
                    
