'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import * as XLSX from 'xlsx'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', price: '', cost: '', stock: '', unit: 'piezas', product_type: 'simple' })
  const [recipeItems, setRecipeItems] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importStep, setImportStep] = useState('upload')
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

  const curr = business?.currency_symbol || '$'

  const openCreate = (type: string = 'simple') => {
    setEditing(null)
    setForm({ name: '', price: '', cost: '', stock: '', unit: 'piezas', product_type: type })
    setRecipeItems([])
    setShowForm(true)
  }

  const openEdit = async (product: any) => {
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
    
    const productData: any = {
      business_id: business.id,
      name: form.name,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      unit: form.unit,
      product_type: form.product_type,
    }
    
    let productId: string
    
    if (editing) {
      await supabase.from('products').update(productData).eq('id', editing.id)
      productId = editing.id
      
      if (editing.product_type === 'receta') {
        await supabase.from('recipe_items').delete().eq('product_id', editing.id)
      }
    } else {
      const { data: newProduct } = await supabase.from('products').insert(productData).select().single()
      productId = newProduct?.id || ''
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

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('products').delete().eq('id', id)
    loadData()
  }

  const addRecipeIngredient = (ingredientId: string) => {
    const ingredient = products.find(p => p.id === ingredientId)
    if (!ingredient) return
    
    setRecipeItems([...recipeItems, {
      product_id: ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: '1',
    }])
  }

  const removeRecipeIngredient = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index))
  }

  const updateRecipeQuantity = (index: number, quantity: string) => {
    const newItems = [...recipeItems]
    newItems[index].quantity = quantity
    setRecipeItems(newItems)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const wb = XLSX.read(data, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet)
      
      if (jsonData && jsonData.length > 0) {
        const headers = Object.keys(jsonData[0])
        setImportHeaders(headers)
        setImportData(jsonData)
        setImportStep('map')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (!business || !importData.length) return
    setLoading(true)
    let count = 0
    
    for (const row of importData) {
      const nameKey = Object.keys(columnMapping).find(k => columnMapping[k] === 'name')
      const priceKey = Object.keys(columnMapping).find(k => columnMapping[k] === 'price')
      const stockKey = Object.keys(columnMapping).find(k => columnMapping[k] === 'stock')
      
      const name = nameKey ? String(row[nameKey] || '').trim() : ''
      if (!name) continue
      
      await supabase.from('products').insert({
        business_id: business.id,
        name: name,
        price: priceKey ? parseFloat(row[priceKey]) || 0 : 0,
        stock: stockKey ? parseFloat(row[stockKey]) || 0 : 0,
        unit: 'piezas',
        product_type: 'simple',
      })
      count++
    }
    
    setLoading(false)
    setShowImport(false)
    setImportData([])
    setImportHeaders([])
    setColumnMapping({})
    setImportStep('upload')
    await loadData()
    alert('✅ ' + count + ' productos importados')
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
          <button onClick={() => setShowImport(true)} className="bg-purple-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            📥 Importar
          </button>
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
          <h2 className="text-lg font-semibold mb-3">🍽️ Recetas (Licuados)</h2>
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
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🍽️ Receta</span>
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
        <h2 className="text-lg font-semibold mb-3">📦 Productos Simples</h2>
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
                  <label className="text-sm font-medium block mb-1">Precio de Venta</label>
                  <input 
                    type="number" 
                    value={form.price} 
                    onChange={(e) => setForm({ ...form, price: e.target.value })} 
                    className="w-full px-3 py-2 rounded-lg border" 
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Costo</label>
                  <input 
                    type="number" 
                    value={form.cost} 
                    onChange={(e) => setForm({ ...form, cost: e.target.value })} 
                    className="w-full px-3 py-2 rounded-lg border" 
                    placeholder="0.00"
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
                      placeholder="0"
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
                  <h3 className="font-semibold mb-3">🧩 Ingredientes de la Receta</h3>
                  
                  {recipeItems.length === 0 && (
                    <p className="text-sm text-gray-500 mb-3">No hay ingredientes. Agrega uno abajo.</p>
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
                        placeholder="Cantidad"
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
                  
                  <div className="mt-3">
                    <label className="text-sm font-medium block mb-1">Agregar Ingrediente</label>
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
                      <option value="">Seleccionar ingrediente...</option>
                      {ingredients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.stock} {p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
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

      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">📥 Importar Excel</h2>
              <button 
                onClick={() => { setShowImport(false); setImportStep('upload') }} 
                className="text-2xl"
              >
                ✕
              </button>
            </div>
            
            {importStep === 'upload' && (
              <div className="text-center py-8 border-2 border-dashed rounded-2xl">
                <p className="text-4xl mb-4">📄</p>
                <label className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold cursor-pointer">
                  Elegir Archivo
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </label>
                <p className="text-sm text-gray-500 mt-3">Solo importa productos simples (no recetas)</p>
              </div>
            )}
            
            {importStep === 'map' && (
              <div>
                <p className="mb-4">{importData.length} filas. Asigna columnas:</p>
                {['name', 'price', 'stock'].map(field => (
                  <div key={field} className="flex items-center gap-4 mb-2">
                    <label className="w-20 text-sm font-medium">{field}</label>
                    <select 
                      value={columnMapping[field] || ''} 
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg border"
                    >
                      <option value="">No usar</option>
                      {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setImportStep('preview')} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold">
                    Siguiente
                  </button>
                  <button onClick={() => setImportStep('upload')} className="px-6 py-2 bg-gray-100 rounded-lg font-semibold">
                    Volver
                  </button>
                </div>
              </div>
            )}
            
            {importStep === 'preview' && (
              <div>
                <p className="mb-4">Se importarán {importData.length} productos</p>
                <div className="flex gap-3">
                  <button onClick={handleImport} className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold">
                    ✅ Importar
                  </button>
                  <button onClick={() => setImportStep('map')} className="px-6 py-2 bg-gray-100 rounded-lg font-semibold">
                    Volver
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
