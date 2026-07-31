'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showMove, setShowMove] = useState<{ type: 'entrada' | 'salida', product: any } | null>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let biz: any = null
    const { data: ownerBiz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (ownerBiz) biz = ownerBiz
    else {
      const { data: pr } = await supabase.from('profiles').select('*, businesses(*)').eq('user_id', user.id).single()
      if (pr) biz = pr.businesses
    }

    if (biz) {
      setBusiness(biz)
      const [p, m] = await Promise.all([
        supabase.from('products').select('*').eq('business_id', biz.id).neq('product_type', 'receta').order('name'),
        supabase.from('inventory_movements').select('*, products(name)').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(50),
      ])
      setProducts(p.data || [])
      setMovements(m.data || [])
    }
    setLoading(false)
  }

  const confirmMove = async () => {
    if (!showMove || !business) return
    const qtyEl = document.getElementById('mvQty') as HTMLInputElement
    const notesEl = document.getElementById('mvNotes') as HTMLInputElement
    const qty = parseFloat(qtyEl?.value) || 0
    if (qty <= 0) return
    const notes = notesEl?.value || ''
    const p = showMove.product
    const newStock = showMove.type === 'entrada' ? Number(p.stock) + qty : Math.max(0, Number(p.stock) - qty)
    await supabase.from('products').update({ stock: newStock }).eq('id', p.id)
    await supabase.from('inventory_movements').insert({
      business_id: business.id, product_id: p.id,
      type: showMove.type, quantity: qty,
      notes: notes || `${showMove.type} manual`,
    })
    setShowMove(null)
    loadData()
  }

  const toggleSelect = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedProducts.length === filtered.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filtered.map(p => p.id))
    }
  }

  const deleteSelected = async () => {
    if (selectedProducts.length === 0) return
    if (!confirm(`¿Eliminar ${selectedProducts.length} productos seleccionados?`)) return
    
    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', selectedProducts)

    if (error) {
      alert('❌ Error: ' + error.message)
    } else {
      setSelectedProducts([])
      await loadData()
    }
  }

  const filtered = products.filter(p => {
    if (filter === 'low') return Number(p.stock) <= Number(p.min_stock) && Number(p.stock) > 0
    if (filter === 'out') return Number(p.stock) <= 0
    return true
  })

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🏷️ Inventario</h1>
      
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Todos</button>
        <button onClick={() => setFilter('low')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${filter === 'low' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>⚠️ Bajo</button>
        <button onClick={() => setFilter('out')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${filter === 'out' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>🔴 Sin Stock</button>
        
        {selectedProducts.length > 0 && (
          <button onClick={deleteSelected} className="ml-auto px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">
            🗑️ Eliminar ({selectedProducts.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedProducts.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Producto</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Stock</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Mínimo</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Estado</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 ${selectedProducts.includes(p.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedProducts.includes(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${Number(p.stock) <= 0 ? 'bg-red-100 text-red-700' : Number(p.stock) <= p.min_stock ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{Number(p.stock)} {p.unit}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.min_stock}</td>
                  <td className="px-4 py-3 text-sm">{Number(p.stock) <= 0 ? '🔴 Agotado' : Number(p.stock) <= p.min_stock ? '⚠️ Bajo' : '✅ OK'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setShowMove({ type: 'entrada', product: p })} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold hover:bg-green-200">+ Entrada</button>
                      <button onClick={() => setShowMove({ type: 'salida', product: p })} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200">- Salida</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-gray-400"><p className="text-4xl mb-3">🏷️</p>No hay productos</div>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">📋 Historial de Movimientos</h2></div>
        {movements.length === 0 ? <div className="p-8 text-center text-gray-400">No hay movimientos</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Producto</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Cantidad</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{new Date(m.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-2 font-medium">{m.products?.name || '-'}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.type === 'entrada' ? 'bg-green-100 text-green-700' : m.type === 'venta' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{m.type}</span></td>
                    <td className="px-4 py-2 font-semibold">{m.quantity}</td>
                    <td className="px-4 py-2 text-gray-500">{m.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-3">{showMove.type === 'entrada' ? '📥 Entrada' : '📤 Salida'} de Stock</h2>
            <p className="text-gray-600 text-sm mb-3">Producto: <strong>{showMove.product.name}</strong> | Stock: <strong>{showMove.product.stock} {showMove.product.unit}</strong></p>
            <input id="mvQty" type="number" step="0.01" className="w-full px-4 py-3 rounded-xl border outline-none mb-3" placeholder="Cantidad" autoFocus />
            <input id="mvNotes" type="text" className="w-full px-4 py-3 rounded-xl border outline-none mb-3" placeholder="Notas (opcional)" />
            <div className="flex gap-3">
              <button onClick={confirmMove} className={`flex-1 py-3 font-bold rounded-xl text-white ${showMove.type === 'entrada' ? 'bg-green-600' : 'bg-red-600'}`}>Confirmar</button>
              <button onClick={() => setShowMove(null)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
