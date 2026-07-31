'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import * as XLSX from 'xlsx'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', price: '', cost: '', stock: '', min_stock: '5', category_id: '', unit: 'piezas', product_type: 'simple', barcode: '', is_sellable: true })
  const [recipeItems, setRecipeItems] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importStep, setImportStep] = useState<'upload' | 'map' | 'preview'>('upload')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

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
      const [prods, cats] = await Promise.all([
        supabase.from('products').select('*').eq('business_id', biz.id).order('name'),
        supabase.from('categories').select('*').eq('business_id', biz.id).order('name'),
      ])
      setProducts(prods.data || [])
      setCategories(cats.data || [])
    }
    setLoading(false)
  }

  const curr = business?.currency_symbol || '$'

  const resetForm = () => {
    setForm({ name: '', price: '', cost: '', stock: '', min_stock: '5', category_id: '', unit: 'piezas', product_type: 'simple', barcode: '', is_sellable: true })
    setRecipeItems([])
    setEditing(null)
    setShowForm(false)
  }

  const openCreate = (type: 'simple' | 'recipe') => {
    resetForm()
    setForm(f => ({ ...f, product_type: type }))
    setShowForm(true)
  }

  const openEdit = async (product: any) => {
    setEditing(product)
    setForm({
      name: product.name,
      price: String(product.price),
      cost: String(product.cost || ''),
      stock: String(product.stock),
      min_stock: String(product.min_stock),
      category_id: product.category_id || '',
      unit: product.unit,
      product_type: product.product_type,
      barcode: product.barcode || '',
      is_sellable: product.is_sellable,
    })
    if (product.product_type === 'receta') {
      const { data } = await supabase.from('recipe_items').select('*, products(name)').eq('product_id', product.id)
      setRecipeItems((data || []).map((r: any) => ({ product_id: r.ingredient_id, quantity: String(r.quantity), name: r.products?.name })))
    } else {
      setRecipeItems([])
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !business) return
    const data: any = {
      name: form.name,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      min_stock: parseFloat(form.min_stock) || 5,
      category_id: form.category_id || null,
      unit: form.unit,
      product_type: form.product_type,
      barcode: form.barcode || null,
      is_sellable: form.is_sellable,
      business_id: business.id,
    }
    if (editing) {
      await supabase.from('products').update(data).eq('id', editing.id)
      if (editing.product_type === 'receta') {
        await supabase.from('recipe_items').delete().eq('product_id', editing.id)
      }
    } else {
      const { data: newP } = await supabase.from('products').insert(data).select().single()
      data.id = newP?.id
    }
    const productId = editing?.id || data.id
    if (form.product_type === 'receta' && productId) {
      for (const ri of recipeItems) {
        if (ri.product_id && parseFloat(ri.quantity) > 0) {
          await supabase.from('recipe_items').insert({ product_id: productId, ingredient_id: ri.product_id, quantity: parseFloat(ri.quantity) })
        }
      }
    }
    resetForm()
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return
    await supabase.from('products').delete().eq('id', id)
    loadData()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet) as any[]
      if (data.length) {
        setImportHeaders(Object.keys(data[0]))
        setImportData(data)
        setImportStep('map')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (!business || !importData.length) return
    setLoading(true)
    let successCount = 0
    let errorCount = 0

    for (const row of importData) {
      try {
        const getValue = (field: string) => {
          const key = Object.entries(columnMapping).find(([, v]) => v === field)?.[0]
          return key ? row[key] : null
        }

        const name = String(getValue('name') || '').trim()
        if (!name) {
          errorCount++
          continue
        }

        const parseNumber = (val: any): number => {
          if (!val) return 0
          const str = String(val).replace(/[^\d.-]/g, '')
          const num = parseFloat(str)
          return isNaN(num) ? 0 : num
        }

        const price = parseNumber(getValue('price'))
        const stock = parseNumber(getValue('stock'))
        const minStock = parseNumber(getValue('min_stock')) || 5
        const cost = parseNumber(getValue('cost'))
        const unitVal = String(getValue('unit') || 'piezas').toLowerCase()
        const validUnits = ['piezas', 'kg', 'litros', 'cajas']
        const unit = validUnits.includes(unitVal) ? unitVal : 'piezas'
        const barcode = String(getValue('barcode') || '').trim() || null
        const sellableVal = String(getValue('sellable') || 'true').toLowerCase()
        const isSellable = sellableVal !== 'false' && sellableVal !== 'no'
        const typeVal = String(getValue('type') || 'simple').toLowerCase()
        const validTypes = ['simple', 'insumo', 'receta']
        const productType = validTypes.includes(typeVal) ? typeVal : 'simple'

        const { error } = await supabase.from('products').insert({
          business_id: business.id,
          name, price, cost, stock, min_stock: minStock,
          unit, barcode, is_sellable, product_type: productType,
        })

        if (error) errorCount++
        else successCount++
      } catch (err) {
        errorCount++
      }
    }

    setLoading(false)
    setShowImport(false)
    setImportData([])
    setImportHeaders([])
    setColumnMapping({})
    setImportStep('upload')
    await loadData()
    alert(`✅ Importación completada\n✓ ${successCount} productos importados\n✗ ${errorCount} errores`)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📦 Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-purple-600 text-white px-3 py-2 rounded-xl font-semibold text-sm">📥 Importar</button>
          <button onClick={() => openCreate('simple')} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">+ Producto</button>
          <button onClick={() => openCreate('recipe')} className="bg-orange-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">🍽️ Receta</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Producto</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Precio</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Stock</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Tipo</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Código</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(p)}>
                  <td className="px-4 py-3"><span className="font-medium text-sm">{p.name}</span>{p.product_type === 'receta' && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">🍽️</span>}{p.product_type === 'insumo' && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Insumo</span>}</td>
                  <td className="px-4 py-3 text-sm">{p.price > 0 ? `${curr}${Number(p.price).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${Number(p.stock) <= 0 ? 'bg-red-100 text-red-700' : Number(p.stock) <= p.min_stock ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{Number(p.stock)}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.product_type === 'receta' ? 'Compuesto' : p.product_type === 'insumo' ? 'Insumo' : 'Simple'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{p.barcode || '-'}</td>
                  <td className="px-4 py-3"><button onClick={e => { e.stopPropagation(); handleDelete(p.id) }} className="text-red-600 text-xs">Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && <div className="p-12 text-center text-gray-400"><p className="text-4xl mb-3">📦</p>No hay productos aún</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">{editing ? '✏️ Editar' : form.product_type === 'recipe' ? '🍽️ Nueva Receta' : '+ Nuevo Producto'}</h2><button onClick={resetForm} className="text-gray-400 text-2xl">✕</button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium block mb-1">Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none" /></div>
              <div><label className="text-sm font-medium block mb-1">Precio</label><input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none" /></div>
              <div><label className="text-sm font-medium block mb-1">Costo</label><input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none" /></div>
              <div><label className="text-sm font-medium block mb-1">Stock</label><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none" /></div>
              <div><label className="text-sm font-medium block mb-1">Mínimo</label><input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none" /></div>
              <div><label className="text-sm font-medium block mb-1">Unidad</label><select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 rounded-lg border">{['piezas', 'kg', 'litros', 'cajas'].map(u => <option key={u}>{u}</option>)}</select></div>
              <div className="col-span-2"><label className="text-sm font-medium block mb-1">Código de Barras</label><input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" /></div>
              {form.product_type !== 'recipe' && <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_sellable} onChange={e => setForm({ ...form, is_sellable: e.target.checked })} /><label className="text-sm">Se puede vender</label></div>}
            </div>
            {form.product_type === 'recipe' && (
              <div className="mt-4 border-t pt-4">
                <h3 className="font-semibold mb-3">🧩 Ingredientes</h3>
                {recipeItems.map((ri, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mb-2">
                    <span className="flex-1 text-sm">{ri.name || 'Ingrediente'}</span>
                    <input type="number" value={ri.quantity} onChange={e => { const n = [...recipeItems]; n[i].quantity = e.target.value; setRecipeItems(n) }} className="w-20 px-2 py-1 border rounded text-sm text-center" />
                    <button onClick={() => setRecipeItems(recipeItems.filter((_, j) => j !== i))} className="text-red-400">✕</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <select onChange={e => { if (e.target.value) { const p = products.find(x => x.id === e.target.value); if (p) setRecipeItems([...recipeItems, { product_id: p.id, quantity: '1', name: p.name }]); e.target.value = '' } }} className="flex-1 px-2 py-1.5 border rounded text-sm">
                    <option value="">Seleccionar ingrediente...</option>
                    {products.filter(p => p.product_type !== 'receta').map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold">{editing ? '💾 Guardar' : '✅ Crear'}</button>
              <button onClick={resetForm} className="px-6 py-2 bg-gray-100 rounded-lg font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">📥 Importar Excel</h2><button onClick={() => { setShowImport(false); setImportStep('upload') }} className="text-gray-400 text-2xl">✕</button></div>
            {importStep === 'upload' && (
              <div className="text-center py-8 border-2 border-dashed rounded-2xl">
                <p className="text-4xl mb-4">📄</p>
                <p className="text-gray-600 mb-2">Selecciona tu archivo Excel o CSV</p>
                <label className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold cursor-pointer">Elegir Archivo<input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" /></label>
                <p className="text-xs text-gray-500 mt-3">Columnas sugeridas: Nombre, Precio, Stock, Código de Barras, Unidad</p>
              </div>
            )}
            {importStep === 'map' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">{importData.length} filas encontradas. Asigna las columnas:</p>
                <div className="space-y-2 mb-4">
                  {[{ f: 'name', l: '📝 Nombre *' }, { f: 'price', l: '💰 Precio' }, { f: 'stock', l: '📦 Stock' }, { f: 'cost', l: '💵 Costo' }, { f: 'min_stock', l: '⚠️ Stock Mínimo' }, { f: 'unit', l: '📏 Unidad' }, { f: 'barcode', l: '📱 Código Barras' }].map(({ f, l }) => (
                    <div key={f} className="flex items-center gap-4">
                      <label className="w-32 text-sm font-medium">{l}</label>
                      <select value={Object.entries(columnMapping).find(([, v]) => v === f)?.[0] || ''} onChange={e => { const m = { ...columnMapping }; Object.keys(m).forEach(k => { if (m[k] === f) delete m[k] }); if (e.target.value) m[e.target.value] = f; setColumnMapping(m) }} className="flex-1 px-3 py-2 rounded-lg border text-sm">
                        <option value="">— No usar —</option>
                        {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setImportStep('preview')} disabled={!Object.values(columnMapping).includes('name')} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold disabled:opacity-50">Siguiente →</button>
                  <button onClick={() => setImportStep('upload')} className="px-6 py-2 bg-gray-100 rounded-lg font-semibold">← Volver</button>
                </div>
              </div>
            )}
            {importStep === 'preview' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">Se importarán {importData.length} productos:</p>
                <div className="overflow-x-auto max-h-48 overflow-y-auto border rounded-xl mb-4">
                  <table className="w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="px-3 py-2 text-left text-xs">#</th><th className="px-3 py-2 text-left text-xs">Nombre</th><th className="px-3 py-2 text-left text-xs">Precio</th><th className="px-3 py-2 text-left text-xs">Stock</th></tr></thead>
                    <tbody className="divide-y">{importData.slice(0, 10).map((row, i) => {
                      const nameKey = Object.entries(columnMapping).find(([, v]) => v === 'name')?.[0]
                      const priceKey = Object.entries(columnMapping).find(([, v]) => v === 'price')?.[0]
                      const stockKey = Object.entries(columnMapping).find(([, v]) => v === 'stock')?.[0]
                      return <tr key={i}><td className="px-3 py-1 text-gray-400">{i + 1}</td><td className="px-3 py-1">{nameKey ? row[nameKey] : '-'}</td><td className="px-3 py-1">{priceKey ? row[priceKey] : '-'}</td><td className="px-3 py-1">{stockKey ? row[stockKey] : '-'}</td></tr>
                    })}</tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleImport} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-50">{loading ? 'Importando...' : '✅ Importar'}</button>
                  <button onClick={() => setImportStep('map')} className="px-6 py-2 bg-gray-100 rounded-lg font-semibold">← Volver</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
