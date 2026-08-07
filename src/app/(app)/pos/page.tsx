'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBranch } from '@/lib/branch-context'
import { useBusiness } from '@/lib/business-context'
import { getRecipeAvailability } from '@/lib/recipeAvailability'

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCartSheet, setShowCartSheet] = useState(false)
  const [showCustomSale, setShowCustomSale] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCost, setCustomCost] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showSaleOk, setShowSaleOk] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [amountPaid, setAmountPaid] = useState('')
  const [isMixedPayment, setIsMixedPayment] = useState(false)
  const [mixedAmounts, setMixedAmounts] = useState({ efectivo: '', tarjeta: '', transferencia: '' })
  const [saleResult, setSaleResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingShift, setOpeningShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [closingAmount, setClosingAmount] = useState('')
  const [expectedCash, setExpectedCash] = useState(0)
  const [expensesInShift, setExpensesInShift] = useState(0)
  const [closingShift, setClosingShift] = useState(false)
  const [submittingSale, setSubmittingSale] = useState(false)
  const [saleError, setSaleError] = useState('')
  const supabase = createClient()
  const { business, loading: businessLoading } = useBusiness()
  const { selectedBranchId, branches, canSwitchBranches } = useBranch()

  useEffect(() => {
    if (business) loadData()
    else if (!businessLoading) setLoading(false)
  }, [business, selectedBranchId])

  const loadData = async () => {
    if (!business) return
    setLoading(true)
    if (selectedBranchId) {
      const { data } = await supabase.from('products').select('*').eq('business_id', business.id).eq('branch_id', selectedBranchId).eq('is_sellable', true).or('product_type.eq.receta,stock.gt.0')
      const rawProducts = data || []
      const recipeIds = rawProducts.filter(p => p.product_type === 'receta').map(p => p.id)
      const availability = await getRecipeAvailability(supabase, recipeIds)
      setProducts(rawProducts.map(p => p.product_type === 'receta' ? { ...p, stock: availability[p.id] || 0 } : p))

      const { data: shift } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('business_id', business.id)
        .eq('branch_id', selectedBranchId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setCurrentShift(shift || null)
    } else {
      setProducts([])
      setCurrentShift(null)
    }
    setLoading(false)
  }

  const openShift = async () => {
    if (!business || !selectedBranchId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setOpeningShift(true)
    const { data } = await supabase.from('cash_shifts').insert({
      business_id: business.id,
      branch_id: selectedBranchId,
      opened_by: user.id,
      opening_amount: parseFloat(openingAmount) || 0,
      status: 'open',
    }).select().single()
    setCurrentShift(data || null)
    setOpeningAmount('')
    setOpeningShift(false)
  }

  const openCloseShiftModal = async () => {
    if (!currentShift) return
    const { data: sales } = await supabase.from('sales').select('id').eq('shift_id', currentShift.id).eq('status', 'completada')
    const saleIds = (sales || []).map(s => s.id)
    let cashSum = 0
    if (saleIds.length > 0) {
      const { data: payments } = await supabase.from('sale_payments').select('amount, method, sale_id').in('sale_id', saleIds).eq('method', 'efectivo')
      cashSum = (payments || []).reduce((s, p) => s + Number(p.amount), 0)
    }
    let returnsSum = 0
    if (saleIds.length > 0) {
      const { data: returns } = await supabase.from('sale_returns').select('total_amount').in('sale_id', saleIds)
      returnsSum = (returns || []).reduce((s, r) => s + Number(r.total_amount), 0)
    }
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('branch_id', currentShift.branch_id)
      .gte('created_at', currentShift.opened_at)
    const expensesSum = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
    setExpensesInShift(expensesSum)
    const expected = Number(currentShift.opening_amount) + cashSum - returnsSum - expensesSum
    setExpectedCash(expected)
    setClosingAmount(expected.toFixed(2))
    setShowCloseShift(true)
  }

  const confirmCloseShift = async () => {
    if (!currentShift) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setClosingShift(true)
    const counted = parseFloat(closingAmount) || 0
    await supabase.from('cash_shifts').update({
      closing_amount: counted,
      expected_amount: expectedCash,
      difference: counted - expectedCash,
      status: 'closed',
      closed_by: user.id,
      closed_at: new Date().toISOString(),
    }).eq('id', currentShift.id)
    setClosingShift(false)
    setShowCloseShift(false)
    setCurrentShift(null)
    setCart([])
  }

  const addToCart = (product: any) => {
    if (product.stock <= 0) return
    const existing = cart.find(i => i.id === product.id)
    if (existing) {
      if (existing.qty >= product.stock) return
      setCart(cart.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i))
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, image_url: product.image_url }])
    }
  }

  const addCustomToCart = () => {
    if (!customName.trim() || !customPrice) return
    setCart([...cart, {
      id: `custom-${crypto.randomUUID()}`,
      name: customName.trim(),
      price: parseFloat(customPrice) || 0,
      qty: 1,
      image_url: null,
      isCustom: true,
      cost: parseFloat(customCost) || 0,
    }])
    setCustomName('')
    setCustomCost('')
    setCustomPrice('')
    setShowCustomSale(false)
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
  const taxRate = business?.tax_percentage != null ? Number(business.tax_percentage) : 13
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax
  const curr = business?.currency_symbol || '$'

  const mixedSum = (parseFloat(mixedAmounts.efectivo) || 0) + (parseFloat(mixedAmounts.tarjeta) || 0) + (parseFloat(mixedAmounts.transferencia) || 0)
  const mixedMatches = Math.abs(mixedSum - total) < 0.01

  const openPayment = () => {
    setAmountPaid(total.toFixed(2))
    setIsMixedPayment(false)
    setMixedAmounts({ efectivo: '', tarjeta: '', transferencia: '' })
    setShowPayment(true)
  }

  const completeSale = async () => {
    if (!business || !selectedBranchId || !currentShift) return
    if (submittingSale) return
    setSaleError('')
    setSubmittingSale(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No se pudo confirmar tu sesión. Cerrá sesión y volvé a entrar.')

      let payments: { method: string; amount: number }[] = []
      let paid = 0
      let change = 0

      if (isMixedPayment) {
        if (!mixedMatches) throw new Error('Los montos del pago mixto no suman el total')
        payments = [
          { method: 'efectivo', amount: parseFloat(mixedAmounts.efectivo) || 0 },
          { method: 'tarjeta', amount: parseFloat(mixedAmounts.tarjeta) || 0 },
          { method: 'transferencia', amount: parseFloat(mixedAmounts.transferencia) || 0 },
        ].filter(p => p.amount > 0)
        paid = mixedSum
        change = 0
      } else {
        paid = parseFloat(amountPaid) || total
        change = paymentMethod === 'efectivo' ? Math.max(0, paid - total) : 0
        payments = [{ method: paymentMethod, amount: total }]
      }

      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        business_id: business.id,
        branch_id: selectedBranchId,
        shift_id: currentShift.id,
        user_id: user.id,
        total: total,
        tax_amount: tax,
        payment_method: isMixedPayment ? 'mixto' : paymentMethod,
        amount_paid: paid,
        change_amount: change,
        status: 'completada',
      }).select().single()

      if (saleErr || !sale) throw new Error(saleErr?.message || 'No se pudo registrar la venta')

      // Mandamos los pagos y las líneas del carrito en paralelo (en vez de uno por uno) para que sea más rápido
      const paymentInserts = payments.map(p =>
        supabase.from('sale_payments').insert({ sale_id: sale.id, method: p.method, amount: p.amount })
      )

      const itemInserts = cart.map(async (item) => {
        const { error: itemErr } = await supabase.from('sale_items').insert({
          sale_id: sale.id,
          product_id: item.isCustom ? null : item.id,
          product_name: item.name,
          quantity: item.qty,
          unit_price: item.price,
          subtotal: item.price * item.qty,
          cost: item.isCustom ? (item.cost || 0) : 0,
          is_custom: !!item.isCustom,
        })
        if (itemErr) throw new Error(`No se pudo guardar "${item.name}": ${itemErr.message}`)

        if (!item.isCustom) {
          const product = products.find(p => p.id === item.id)
          if (product?.product_type === 'receta') {
            await supabase.rpc('decrement_recipe', { p_product_id: item.id, p_multiplier: item.qty })
          } else {
            await supabase.rpc('decrement_stock', { p_product_id: item.id, p_quantity: item.qty })
          }
        }
      })

      await Promise.all([...paymentInserts, ...itemInserts])

      setSaleResult({ total, change, method: isMixedPayment ? 'mixto' : paymentMethod, products: cart })
      setCart([])
      setShowPayment(false)
      setShowSaleOk(true)
      loadData()
    } catch (err: any) {
      console.error('Error al cobrar:', err)
      setSaleError(err.message || 'No se pudo completar la venta. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setSubmittingSale(false)
    }
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

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[]
  const filtered = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search))
    .filter(p => !selectedCategory || p.category === selectedCategory)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  if (businessLoading || loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  if (!selectedBranchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-4xl mb-3">🏬</p>
        <p className="font-semibold text-gray-700">Elegí una sucursal específica arriba para empezar a cobrar</p>
        <p className="text-sm text-gray-400 mt-1">No se puede vender desde "Todas las sucursales" a la vez</p>
      </div>
    )
  }

  if (!currentShift) {
    return (
      <div className="max-w-sm mx-auto py-10 text-center">
        <p className="text-4xl mb-3">🧾</p>
        <h2 className="font-bold text-lg text-gray-900 mb-1">Abrí tu turno de caja</h2>
        <p className="text-sm text-gray-500 mb-5">Antes de vender, decinos con cuánto efectivo empezás la caja hoy.</p>
        <label className="text-sm font-medium block mb-1 text-left">Efectivo inicial en caja</label>
        <input
          type="number"
          value={openingAmount}
          onChange={e => setOpeningAmount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border outline-none text-lg text-center mb-4"
          placeholder="0.00"
          autoFocus
        />
        <button onClick={openShift} disabled={openingShift || !openingAmount} className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl disabled:opacity-50">
          {openingShift ? 'Abriendo...' : 'Abrir turno y empezar a vender'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 6rem)' }}>
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h1 className="text-2xl font-bold">🛒 Punto de Venta</h1>
          <button onClick={openCloseShiftModal} className="text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-2 rounded-xl border flex-shrink-0">
            🧾 Turno: {curr}{Number(currentShift.opening_amount).toFixed(2)} · Cerrar
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar producto..." className="w-full px-4 py-3 rounded-xl border outline-none mb-3" />
        <button
          onClick={() => setShowCustomSale(true)}
          className="w-full mb-3 py-3 rounded-xl border-2 border-dashed border-primary-300 text-primary-600 font-semibold hover:bg-primary-50"
        >
          ✏️ Venta libre (algo que no está en el catálogo)
        </button>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-1 -mx-1 px-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 whitespace-nowrap ${!selectedCategory ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-200 text-gray-600'}`}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 whitespace-nowrap ${selectedCategory === cat ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-200 text-gray-600'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.product_type === 'receta' && p.stock <= 0} className="bg-white rounded-xl p-3 border hover:border-primary-300 hover:shadow-md transition text-left flex flex-col disabled:opacity-40 disabled:cursor-not-allowed">
                <div className="w-full aspect-square rounded-lg bg-gray-100 mb-2 overflow-hidden flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-gray-300">{p.product_type === 'receta' ? '🍽️' : '📦'}</span>
                  )}
                </div>
                <p className="font-medium text-sm truncate">{p.name}</p>
                {p.product_type === 'receta' && business?.show_recipe_availability !== false && (
                  <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${p.stock > 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600'}`}>
                    🍽️ {p.stock > 0 ? `Alcanza para ${p.stock}` : 'Sin ingredientes'}
                  </span>
                )}
                <p className="text-primary-600 font-bold mt-1">{curr}{p.price.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-80 bg-white rounded-2xl shadow-sm border flex-col">
        <div className="p-4 border-b flex justify-between"><h2 className="font-semibold">🧾 Carrito</h2>{cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500">Vaciar</button>}</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? <p className="text-center text-gray-400 py-8">Agrega productos</p> : cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
              <div className="w-9 h-9 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xs">📦</span>}
              </div>
              <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{item.name}{item.isCustom && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full align-middle">Libre</span>}</p><p className="text-xs text-gray-500">{curr}{item.price.toFixed(2)}</p></div>
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

      {/* Barra fija abajo, solo en celular */}
      {cartCount > 0 && (
        <button
          onClick={() => setShowCartSheet(true)}
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-primary-600 text-white px-5 py-4 flex items-center justify-between shadow-lg"
        >
          <span className="flex items-center gap-2 font-semibold">
            <span className="bg-white text-primary-600 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{cartCount}</span>
            Ver carrito
          </span>
          <span className="flex items-center gap-2 font-bold text-lg">{curr}{total.toFixed(2)} ›</span>
        </button>
      )}

      {/* Carrito deslizable, solo en celular */}
      {showCartSheet && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold">🧾 Carrito</h2>
              <div className="flex items-center gap-4">
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500">Vaciar</button>}
                <button onClick={() => setShowCartSheet(false)} className="text-gray-400 text-xl leading-none">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 ? <p className="text-center text-gray-400 py-8">Agrega productos</p> : cart.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                  <div className="w-9 h-9 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xs">📦</span>}
                  </div>
                  <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{item.name}{item.isCustom && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full align-middle">Libre</span>}</p><p className="text-xs text-gray-500">{curr}{item.price.toFixed(2)}</p></div>
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
              <button onClick={() => { setShowCartSheet(false); openPayment() }} disabled={cart.length === 0} className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl mt-2 disabled:opacity-50">Cobrar {curr}{total.toFixed(2)}</button>
            </div>
          </div>
        </div>
      )}

      {showCustomSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-1">✏️ Venta libre</h2>
            <p className="text-sm text-gray-500 mb-4">Para algo que el cliente pidió especial y no está en el catálogo. No descuenta inventario.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">¿Qué se vendió?</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border outline-none"
                  placeholder="Ej: Combo especial pedido por cliente"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Costo <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    type="number"
                    value={customCost}
                    onChange={e => setCustomCost(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Precio a cobrar</label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={addCustomToCart} disabled={!customName.trim() || !customPrice} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl disabled:opacity-50">Agregar al carrito</button>
              <button onClick={() => { setShowCustomSale(false); setCustomName(''); setCustomCost(''); setCustomPrice('') }} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">💰 Cobro</h2>
              <button
                onClick={() => setIsMixedPayment(!isMixedPayment)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${isMixedPayment ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-600'}`}
              >
                🔀 Pago mixto
              </button>
            </div>

            {!isMixedPayment ? (
              <>
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
              </>
            ) : (
              <div className="space-y-3 mb-3">
                <div className="bg-gray-50 rounded-xl p-3"><div className="flex justify-between text-lg font-bold"><span>Total a cubrir</span><span>{curr}{total.toFixed(2)}</span></div></div>
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
                  Suma: {curr}{mixedSum.toFixed(2)} {mixedMatches ? '✓ Coincide con el total' : `(falta ${curr}${(total - mixedSum).toFixed(2)})`}
                </p>
              </div>
            )}

            {saleError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{saleError}</div>}

            <div className="flex gap-3 mt-4">
              <button onClick={completeSale} disabled={submittingSale || (isMixedPayment && !mixedMatches)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-50">
                {submittingSale ? 'Procesando...' : '✓ Confirmar'}
              </button>
              <button onClick={() => setShowPayment(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-1">🧾 Cerrar turno</h2>
            <p className="text-sm text-gray-500 mb-4">Contá el efectivo físico que hay en la caja ahorita y ponelo abajo.</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Efectivo inicial</span><span>{curr}{Number(currentShift.opening_amount).toFixed(2)}</span></div>
              {expensesInShift > 0 && <div className="flex justify-between text-red-600"><span>Gastos pagados de la caja</span><span>-{curr}{expensesInShift.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Efectivo esperado en caja</span><span>{curr}{expectedCash.toFixed(2)}</span></div>
            </div>
            <label className="text-sm font-medium block mb-1">Efectivo contado</label>
            <input
              type="number"
              value={closingAmount}
              onChange={e => setClosingAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border outline-none text-lg text-center mb-2"
            />
            {closingAmount && (
              <p className={`text-sm font-semibold mb-3 ${Math.abs((parseFloat(closingAmount) || 0) - expectedCash) < 0.01 ? 'text-green-600' : (parseFloat(closingAmount) || 0) > expectedCash ? 'text-blue-600' : 'text-red-500'}`}>
                Diferencia: {curr}{((parseFloat(closingAmount) || 0) - expectedCash).toFixed(2)}
                {Math.abs((parseFloat(closingAmount) || 0) - expectedCash) < 0.01 ? ' (cuadra perfecto)' : (parseFloat(closingAmount) || 0) > expectedCash ? ' (sobra)' : ' (falta)'}
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={confirmCloseShift} disabled={closingShift} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl disabled:opacity-50">
                {closingShift ? 'Cerrando...' : 'Cerrar turno'}
              </button>
              <button onClick={() => setShowCloseShift(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
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
