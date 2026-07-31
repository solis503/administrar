'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showMove, setShowMove] = useState<any>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    
    let biz: any = null
    const { data: ob } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (ob) {
      biz = ob
    } else {
      const { data: pr } = await supabase.from('profiles').select('*, businesses(*)').eq('user_id', user.id).single()
      if (pr && pr.businesses) {
        biz = pr.businesses
      }
    }
    
    if (biz) {
      setBusiness(biz)
      const { data: prods } = await supabase.from('products').select('*').eq('business_id', biz.id).order('name')
      setProducts(prods || [])
    }
    setLoading(false)
  }

  const confirmMove = async () => {
    if (!showMove || !business) return
    const qtyInput = document.getElementById('mvQty') as HTMLInputElement
    const notesInput = document.getElementById('mvNotes') as HTMLInputElement
    const qty = parseFloat(qtyInput?.value) || 0
    if (qty <= 0) return
    
    const notes = notesInput?.value || ''
    const newStock = showMove.type === 'entrada' 
      ? Number(showMove.product.stock) + qty 
      : Math.max(0, Number(showMove.product.stock) - qty)
    
    await supabase.from('products').update({ stock: newStock }).eq('id', showMove.product.id)
    await supabase.from('inventory_movements').insert({
      business_id: business.id,
      product_id: showMove.product.id,
      type: showMove.type,
      quantity: qty,
      notes: notes || showMove.type,
    })
    setShowMove(null)
    loadData()
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const toggleAll = () => {
    if (selected.length === filtered.length) {
      setSelected([])
    } else {
      setSelected(filtered.map(p => p.id))
    }
  }

  const deleteSelected = async () => {
    if (selected.length === 0) return
    if (!confirm('¿Eliminar ' + selected.length + ' productos?')) return
    await supabase.from('products').delete().in('id', selected)
    setSelected([])
    loadData()
  }

  const filtered = products.filter(p => {
    if (filter === 'low') return Number(p.stock) <= Number(p.min_stock) && Number(p.stock) > 0
    if (filter === 'out') return Number(p.stock) <= 0
    return true
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
      <h1 className="text-2xl font-bold mb-6">🏷️ Inventario</h1>
      
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button 
          onClick={() => setFilter('all')} 
          className={`px-4 py-2 rounded-xl text-sm font-semibold ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
        >
          Todos
        </button>
        <button 
          onClick={() => setFilter('low')} 
          className={`px-4 py-2 rounded-xl text-sm font-semibold ${filter === 'low' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
        >
          ⚠️ Bajo
        </button>
        <button 
          onClick={() => setFilter('out')} 
          className={`px-4 py-2 rounded-xl text-sm font-semibold ${filter === 'out' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
        >
          🔴 Sin Stock
        </button>
        
        {selected.length > 0 && (
          <button 
            onClick={deleteSelected} 
            className="ml-auto px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold"
          >
            🗑️ Eliminar ({selected.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 w-12">
                <input 
                  type="checkbox" 
                  checked={selected.length === filtered.length && filtered.length > 0} 
                  onChange={toggleAll} 
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
              <tr key={p.id} className={`hover:bg-gray-50 ${selected.includes(p.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-3">
                  <input 
                    type="checkbox" 
                    checked={selected.includes(p.id)} 
                    onChange={() => toggleSelect(p.id)} 
                  />
                </td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    {Number(p.stock)} {p.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.min_stock}</td>
                <td className="px-4 py-3">
                  {Number(p.stock) <= 0 ? '🔴' : Number(p.stock) <= p.min_stock ? '⚠️' : '✅'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setShowMove({ type: 'entrada', product: p })} 
                      className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold"
                    >
                      + Entrada
                    </button>
                    <button 
                      onClick={() => setShowMove({ type: 'salida', product: p })} 
                      className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold"
                    >
                      - Salida
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showMove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-3">
              {showMove.type === 'entrada' ? '📥 Entrada' : '📤 Salida'}
            </h2>
            <p className="mb-3">
              {showMove.product.name} | Stock: {showMove.product.stock}
            </p>
            <input 
              id="mvQty" 
              type="number" 
              className="w-full px-4 py-3 rounded-xl border mb-3" 
              placeholder="Cantidad" 
            />
            <input 
              id="mvNotes" 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border mb-3" 
              placeholder="Notas" 
            />
            <div className="flex gap-3">
              <button 
                onClick={confirmMove} 
                className={`flex-1 py-3 font-bold rounded-xl text-white ${showMove.type === 'entrada' ? 'bg-green-600' : 'bg-red-600'}`}
              >
                Confirmar
              </button>
              <button 
                onClick={() => setShowMove(null)} 
                className="px-6 py-3 bg-gray-100 rounded-xl font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
