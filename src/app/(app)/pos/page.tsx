'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBranch } from '@/lib/branch-context'

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showSaleOk, setShowSaleOk] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [amountPaid, setAmountPaid] = useState('')
  const [saleResult, setSaleResult] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { selectedBranchId, branches, canSwitchBranches } = useBranch()

  useEffect(() => { loadData() }, [selectedBranchId])

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
      if (selectedBranchId) {
        const { data } = await supabase.from('products').select('*').eq('business_id', biz.id).eq('branch_id', selectedBranchId).eq('is_sellable', true).gt('stock', 0)
        setProducts(data || [])
      } else {
        setProducts([])
      }
    }
    setLoading(false)
  }

  const addToCart = (product: any) => {
    const existing = cart.find(i => i.id === product.id)
    if (existing) {
      if (existing.qty >= product.stock) return
      setCart(cart.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i))
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, image_url: product.image_url }])
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(i => {
      if (i.id === id) {
        const product = products.find(p => p.id === id)
        const newQty = Math.max(0, i.qty + delta)
        if (product && newQty > product.stock) return i
        return { ...i, qty: newQty }
      }
      return i
    }).filter(i => i.qty > 0))
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const taxRate = business?.tax_percentage || 13
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax
  const curr = business?.currency_symbol || '$'

  const openPayment = () => {
    setAmountPaid(total.toFixed(2))
    setShowPayment(true)
  }

  const completeSale = async () => {
    if (!business || !selectedBranchId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const paid = parseFloat(amountPaid) || total
    const change = paymentMethod === 'efectivo' ? Math.max(0, paid - total) : 0

    const { data: sale } = await supabase.from('sales').insert({
      business_id: business.id,
      branch_id: selectedBranchId,
      user_id: user.id,
      total: total,
      tax_amount: tax,
      payment_method: paymentMethod,
      amount_paid: paid,
      change_amount: change,
    }).select().single()

    if (!sale) return

    for (const item of cart) {
      await supabase.from('sale_items').insert({
        sale_id: sale.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
        subtotal: item.price * item.qty,
      })

      const product = products.find(p => p.id === item.id)
      if (product?.product_type === 'receta') {
        await supabase.rpc('decrement_recipe', { p_product_id: item.id, p_multiplier: item.qty })
      } else {
        await supabase.rpc('decrement_stock', { p_product_id: item.id, p_quantity: item.qty })
      }
    }

    setSaleResult({ total, change, method: paymentMethod, products: cart })
    setCart([])
    setShowPayment(false)
    setShowSaleOk(true)
    loadData()
  }

  const printTicket = () => {
    if (!saleResult || !business) return
    const items = saleResult.products.map((p: any) => `<tr><td style="padding:2px 0">${p.name} x${p.qty}</td><td style="text-align:right">${curr}${(p.price * p.qty).toFixed(2)}</td></tr>`).join('')
    const win = window.open('', '_blank', 'width=350,height=600')
    if (!win) return
    win.document.write(`<html><head><title>Ticket</title><style>body{font-family:monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto}table{width:100%;border-collapse:collapse}.c{text-align:center}.line{border-top:1px dashed #000;margin:5px 0}</style></head><body><div class="c"><strong>${business.name}</strong><br>${new Date().toLocaleString('es')}<br>Ticket #${Date.now().toString().slice(-6)}</div><div class="line"></div><table>${items}</table><div class="line"></div><table><tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>${curr}${saleResult.total.toFixed(2)}</strong></td></tr><tr><td>Método:</td><td style="text-align:right">${saleResult.method}</td></tr>${saleResult.method === 'efectivo' ? `<tr><td>Pagado:</td><td style="text-align:right">${curr}${(saleResult.total + saleResult.change).toFixed(2)}</td></tr><tr><td>Cambio:</td><td style="text-align:right">${curr}${saleResult.change.toFixed(2)}</td></tr>` : ''}</table><div class="line"></div><div class="c">¡Gracias por su compra!</div></body></html>`)
    win.document.close()
    win.print()
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  if (!selectedBranchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-4xl mb-3">🏬</p>
        <p className="font-semibold text-gray-700">Elegí una sucursal específica arriba para empezar a cobrar</p>
        <p className="text-sm text-gray-400 mt-1">No se puede vender desde "Todas las sucursales" a la vez</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 6rem)' }}>
      <div className="flex-1 flex flex-col">
        <h1 className="text-2xl font-bold mb-4">🛒 Punto de Venta</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar producto..." className="w-full px-4 py-3 rounded-xl border outline-none mb-4" />
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="bg-white rounded-xl p-3 border hover:border-primary-300 hover:shadow-md transition text-left flex flex-col">
                <div className="w-full aspect-square rounded-lg bg-gray-100 mb-2 overflow-hidden flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-gray-300">{p.product_type === 'receta' ? '🍽️' : '📦'}</span>
                  )}
                </div>
                <p className="font-medium text-sm truncate">{p.name}</p>
                {p.product_type === 'receta' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full w-fit">🍽️</span>}
                <p className="text-primary-600 font-bold mt-1">{curr}{p.price.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:w-80 bg-white rounded-2xl shadow-sm border flex flex-col">
        <div className="p-4 border-b flex justify-between"><h2 className="font-semibold">🧾 Carrito</h2>{cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500">Vaciar</button>}</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? <p className="text-center text-gray-400 py-8">Agrega productos</p> : cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
              <div className="w-9 h-9 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xs">📦</span>}
              </div>
              <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{item.name}</p><p className="text-xs text-gray-500">{curr}{item.price.toFixed(2)}</p></div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded bg-white border">-</button>
                <span className="w-8 text-center font-semibold">{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded bg-white border">+</button>
              </div>
              <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400">✕</button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t space-y-1">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{curr}{subtotal.toFixed(2)}</span></div>
          {taxRate > 0 && <div className="flex justify-between text-sm text-gray-600"><span>IVA ({taxRate}%)</span><span>{curr}{tax.toFixed(2)}</span></div>}
          <div className="flex justify-between text-xl font-bold border-t pt-2"><span>Total</span><span>{curr}{total.toFixed(2)}</span></div>
          <button onClick={openPayment} disabled={cart.length === 0} className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl mt-2 disabled:opacity-50">Cobrar {curr}{total.toFixed(2)}</button>
        </div>
      </div>

      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">💰 Cobro</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[{ v: 'efectivo', l: '💵 Efectivo' }, { v: 'tarjeta', l: '💳 Tarjeta' }, { v: 'transferencia', l: '🏦 Transfer.' }].map(m => (
                <button key={m.v} onClick={() => setPaymentMethod(m.v)} className={`py-3 rounded-xl border-2 font-semibold ${paymentMethod === m.v ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>{m.l}</button>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-3"><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{curr}{total.toFixed(2)}</span></div></div>
            {paymentMethod === 'efectivo' && (
              <div className="mb-3">
                <label className="text-sm font-medium block mb-1">¿Cuánto entrega el cliente?</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-lg" />
                {parseFloat(amountPaid) >= total && <p className="text-green-600 font-semibold mt-1">Vuelto: {curr}{(parseFloat(amountPaid) - total).toFixed(2)}</p>}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={completeSale} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl">✓ Confirmar</button>
              <button onClick={() => setShowPayment(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showSaleOk && saleResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">¡Venta Exitosa!</h2>
            <p className="text-3xl font-bold text-primary-600">{curr}{saleResult.total.toFixed(2)}</p>
            {saleResult.method === 'efectivo' && saleResult.change > 0 && <p className="text-lg text-green-600 font-semibold mt-1">Vuelto: {curr}{saleResult.change.toFixed(2)}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={printTicket} className="flex-1 py-2.5 bg-gray-800 text-white font-bold rounded-xl">🖨️ Imprimir</button>
              <button onClick={() => { setShowSaleOk(false); setSaleResult(null) }} className="flex-1 py-2.5 bg-primary-600 text-white font-bold rounded-xl">Nueva Venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
