'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [business, setBusiness] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', price: '', cost: '', stock: '', unit: 'piezas', product_type: 'simple' })
  const [recipeItems, setRecipeItems] = useState([])
  const [loading, setLoading] = useState(true)
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
    
    let biz = null
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

  const curr = business ? business.currency_symbol : '$'

  const openCreate = (type) => {
    setEditing(null)
    setForm({ name: '', price: '', cost: '', stock: '', unit: 'piezas', product_type: type })
    setRecipeItems([])
    setShowForm(true)
  }

  const openEdit = async (product) => {
    setEditing(product)
    setForm({
      name: product.name,
      price: String(product.price),
      cost: String(product.cost || ''),
      stock: String(product.stock),
      unit: product.unit,
      product_type: product.product_type,
    })
    
    if (product.product_type === 'receta') {
      const { data } = await supabase
        .from('recipe_items')
        .select('*, products(name, unit)')
        .eq('product_id', product.id)
      setRecipeItems(data || [])
    } else {
      setRecipeItems([])
    }
    
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !business) return
    
    const productData = {
      business_id: business.id,
      name: form.name,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      unit: form.unit,
      product_type: form.product_type,
    }
    
    let productId
    
    if (editing) {
      await supabase.from('products').update(productData).eq('id', editing.id)
      productId = editing.id
      
      if (editing.product_type === 'receta') {
        await supabase.from('recipe_items').delete().eq('product_id', editing.id)
      }
    } else {
      const { data: newProduct } = await supabase.from('products').insert(productData).select().single()
      productId = newProduct ? newProduct.id : ''
    }
    
    if (form.product_type === 'receta' && recipeItems.length > 0) {
      for (const item of recipeItems) {
        if (item.product_id && parseFloat(item.quantity) > 0) {
          await supabase.from('recipe_items').insert({
            product_id: productId,
            ingredient_id: item.product_id,
            quantity: parseFloat(item.quantity),
          })
        }
      }
    }
    
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('products').delete().eq('id', id)
    loadData()
  }

  const addRecipeIngredient = (ingredientId) => {
    const ingredient = products.find(p => p.id === ingredientId)
    if (!ingredient) return
    
    setRecipeItems([...recipeItems, {
      product_id: ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: '1',
    }])
  }

  const removeRecipeIngredient = (index) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index))
  }

  const updateRecipeQuantity = (index, quantity) => {
    const newItems = [...recipeItems]
    newItems[index].quantity = quantity
    setRecipeItems(newItems)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    )
  }

  const ingredients = products.filter(p => p.product_type !== 'receta')
  const recipes = products.filter(p => p.product_type === 'receta')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📦 Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => openCreate('simple')} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            + Producto
          </button>
          <button onClick={() => openCreate('receta')} className="bg-orange-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            🍽️ Receta
          </button>
        </div>
      </div>

      {recipes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">🍽️ Recetas</h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Receta</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Precio</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Stock</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recipes.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(p)}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🍽️</span>
                    </td>
                    <td className="px-4 py-3">{curr}{Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        {Number(p.stock)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} 
                        className="text-red-600 text-xs"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">📦 Productos</h2>
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Producto</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Precio</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Stock</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.filter(p => p.product_type !== 'receta').map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(p)}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{curr}{Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      {Number(p.stock)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} 
                      className="text-red-600 text-xs"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editing ? '✏️ Editar' : '+ Nuevo'} {form.product_type === 'receta' ? 'Receta' : 'Producto'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Nombre</label>
                <input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="w-full px-3 py-2 rounded-lg border" 
                  placeholder={form.product_type === 'receta' ? 'Ej: Licuado de Fresa' : 'Ej: Fresa'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Precio</label>
                  <input 
                    type="number" 
                    value={form.price} 
                    onChange={(e) => setForm({ ...form, price: e.target.value })} 
                    className="w-full px-3 py-2 rounded-lg border" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Costo</label>
                  <input 
                    type="number" 
                    value={form.cost} 
                    onChange={(e) => setForm({ ...form, cost: e.target.value })} 
                    className="w-full px-3 py-2 rounded-lg border" 
                  />
                </div>
              </div>
              {form.product_type !== 'receta' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Stock</label>
                    <input 
                      type="number" 
                      value={form.stock} 
                      onChange={(e) => setForm({ ...form, stock: e.target.value })} 
                      className="w-full px-3 py-2 rounded-lg border" 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Unidad</label>
                    <select 
                      value={form.unit} 
                      onChange={(e) => setForm({ ...form, unit: e.target.value })} 
                      className="w-full px-3 py-2 rounded-lg border"
                    >
                      <option value="piezas">Piezas</option>
                      <option value="kg">Kilogramos</option>
                      <option value="litros">Litros</option>
                      <option value="cajas">Cajas</option>
                    </select>
                  </div>
                </div>
              )}

              {form.product_type === 'receta' && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">🧩 Ingredientes</h3>
                  
                  {recipeItems.length === 0 && (
                    <p className="text-sm text-gray-500 mb-3">No hay ingredientes</p>
                  )}
                  
                  {recipeItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 mb-2">
                      <span className="flex-1 font-medium">{item.name}</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={item.quantity} 
                        onChange={(e) => updateRecipeQuantity(index, e.target.value)}
                        className="w-24 px-2 py-1 border rounded text-center" 
                      />
                      <span className="text-sm text-gray-500">{item.unit}</span>
                      <button 
                        onClick={() => removeRecipeIngredient(index)}
                        className="text-red-500 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  <select 
                    onChange={(e) => {
                      if (e.target.value) {
                        addRecipeIngredient(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border"
                    defaultValue=""
                  >
                    <option value="">Agregar ingrediente...</option>
                    {ingredients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">
                💾 Guardar
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
