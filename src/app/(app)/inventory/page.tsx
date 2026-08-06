'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useBranch } from '@/lib/branch-context'
import { getRecipeAvailability } from '@/lib/recipeAvailability'

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [recipeAvailability, setRecipeAvailability] = useState<Record<string, number>>({})
  const [business, setBusiness] = useState<any>(null)
  const [showMove, setShowMove] = useState<any>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const supabase = createClient()
  const { selectedBranchId } = useBranch()

  useEffect(() => {
    loadData()
  }, [selectedBranchId])

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
      let query = supabase.from('products').select('*').eq('business_id', biz.id).order('name')
      if (selectedBranchId) query = query.eq('branch_id', selectedBranchId)
      const { data: prods } = await query
      setProducts(prods || [])
      const recipeIds = (prods || []).filter(p => p.product_type === 'receta').map(p => p.id)
      setRecipeAvailability(await getRecipeAvailability(supabase, recipeIds))
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

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deleteSelected = async () => {
    if (selected.length === 0) return
    setDeleting(true)
    const { error } = await supabase.from('products').delete().in('id', selected)
    setDeleting(false)
    if (error) {
      alert('No se pudo eliminar: ' + error.message)
      return
    }
    setConfirmBulkDelete(false)
    setSelected([])
    loadData()
  }

  const filtered = products.filter(p => {
    if (p.product_type === 'receta') return false
    if (filter === 'low') return Number(p.stock) <= Number(p.min_stock) && Number(p.stock) > 0
    if (filter === 'out') return Number(p.stock) <= 0
    return true
  })
  const recipes = products.filter(p => p.product_type === 'receta')

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
            onClick={() => setConfirmBulkDelete(true)} 
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
        {filtered.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">Nada por aquí</p>}
      </div>

      {recipes.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">🍽️ Recetas <span className="text-xs font-normal text-gray-400">(su disponibilidad se calcula sola según los ingredientes, no se ajusta a mano)</span></h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Receta</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Alcanza para</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recipes.map(p => {
                  const available = recipeAvailability[p.id] || 0
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">🍽️ {p.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {available} unidades
                        </span>
                      </td>
                      <td className="px-4 py-3">{available <= 0 ? '🔴' : available <= 3 ? '⚠️' : '✅'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <h2 className="text-lg font-bold mb-1">¿Eliminar {selected.length} productos?</h2>
            <p className="text-sm text-gray-500 mb-5">Esto no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={deleteSelected} disabled={deleting} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50">
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button onClick={() => setConfirmBulkDelete(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
              
