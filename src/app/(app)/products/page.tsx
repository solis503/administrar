'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import * as XLSX from 'xlsx'
import { useBranch } from '@/lib/branch-context'

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre del producto (obligatorio)',
  price: 'Precio de venta',
  cost: 'Costo',
  stock: 'Stock / Cantidad',
  unit: 'Unidad',
}

const AUTO_DETECT_HINTS: Record<string, string[]> = {
  name: ['nombre', 'producto', 'name', 'product', 'descripcion', 'artículo', 'articulo'],
  price: ['precio', 'price', 'pvp', 'venta'],
  cost: ['costo', 'cost'],
  stock: ['stock', 'cantidad', 'cant', 'existencia', 'quantity'],
  unit: ['unidad', 'unit'],
}

const RECIPE_FIELD_LABELS: Record<string, string> = {
  recipe: 'Nombre de la receta (obligatorio)',
  price: 'Precio de venta',
  ingredient: 'Ingrediente (obligatorio)',
  quantity: 'Cantidad del ingrediente',
  unit: 'Unidad',
}

const RECIPE_AUTO_DETECT_HINTS: Record<string, string[]> = {
  recipe: ['receta', 'recipe', 'plato', 'combo'],
  price: ['precio', 'price', 'pvp', 'venta'],
  ingredient: ['ingrediente', 'ingredient', 'insumo'],
  quantity: ['cantidad', 'cant', 'quantity'],
  unit: ['unidad', 'unit'],
}

// Busca la fila que más se parece a encabezados de tabla (nombre/precio/receta/ingrediente/etc.),
// para saltar filas de reportes/metadatos que a veces vienen arriba del archivo real.
const findHeaderRowIndex = (aoa: any[][]): number => {
  const allHints = [...Object.values(AUTO_DETECT_HINTS).flat(), ...Object.values(RECIPE_AUTO_DETECT_HINTS).flat()]
  let bestRow = 0
  let bestScore = 0
  const maxScan = Math.min(aoa.length, 25)
  for (let i = 0; i < maxScan; i++) {
    const row = aoa[i] || []
    const nonEmptyCells = row.filter((c) => String(c ?? '').trim() !== '')
    if (nonEmptyCells.length < 2) continue // una fila de tabla real suele tener varias columnas
    const score = nonEmptyCells.filter((c) =>
      allHints.some((hint) => String(c).toLowerCase().trim().includes(hint))
    ).length
    if (score > bestScore) {
      bestScore = score
      bestRow = i
    }
  }
  return bestScore >= 2 ? bestRow : 0
}

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', price: '', cost: '', stock: '', unit: 'piezas', product_type: 'simple', image_url: '', category: '' })
  const [recipeItems, setRecipeItems] = useState<any[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importMode, setImportMode] = useState<'products' | 'recipes'>('products')
  const [importStep, setImportStep] = useState('upload') // upload | map | result
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importRows, setImportRows] = useState<any[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; skipped: string[] }>({ success: 0, skipped: [] })
  const supabase = createClient()
  const { selectedBranchId, branches, canSwitchBranches } = useBranch()

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
      let query = supabase.from('products').select('*').eq('business_id', biz.id).order('name')
      if (selectedBranchId) query = query.eq('branch_id', selectedBranchId)
      const { data: prods } = await query
      setProducts(prods || [])
    }
    setLoading(false)
  }

  const curr = business ? business.currency_symbol : '$'

  const openCreate = (type: string) => {
    setEditing(null)
    setForm({ name: '', price: '', cost: '', stock: '', unit: 'piezas', product_type: type, image_url: '', category: '' })
    setRecipeItems([])
    setImageFile(null)
    setImagePreview('')
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
      image_url: product.image_url || '',
      category: product.category || '',
    })
    setImageFile(null)
    setImagePreview(product.image_url || '')
    
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede pesar más de 5MB')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
    setForm({ ...form, image_url: '' })
  }

  const uploadProductImage = async (file: File): Promise<string | null> => {
    if (!business) return null
    const ext = file.name.split('.').pop()
    const path = `${business.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      alert('No se pudo subir la imagen: ' + error.message)
      return null
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!form.name || !business) return

    const targetBranchId = editing
      ? editing.branch_id
      : (selectedBranchId || (branches.length === 1 ? branches[0].id : null))

    if (!targetBranchId) {
      alert('Elegí una sucursal específica arriba (no "Todas las sucursales") antes de crear un producto')
      return
    }

    setUploadingImage(true)
    let imageUrl = form.image_url
    if (imageFile) {
      const uploadedUrl = await uploadProductImage(imageFile)
      if (uploadedUrl) imageUrl = uploadedUrl
    }
    setUploadingImage(false)

    const productData = {
      business_id: business.id,
      branch_id: targetBranchId,
      name: form.name,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      unit: form.unit,
      product_type: form.product_type,
      image_url: imageUrl || null,
      category: form.category.trim() || null,
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

  const openImportModal = (mode: 'products' | 'recipes') => {
    setImportMode(mode)
    setImportStep('upload')
    setImportHeaders([])
    setImportRows([])
    setColumnMapping({})
    setImportResult({ success: 0, skipped: [] })
    setShowImportModal(true)
  }

  const parseNumber = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0
    const str = String(value).replace(/[^\d.-]/g, '')
    const num = parseFloat(str)
    return isNaN(num) ? 0 : num
  }

  const handleExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]

        // Leemos como matriz cruda primero para poder ubicar dónde empieza la tabla real
        const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
        if (!aoa.length) {
          alert('El archivo no tiene datos')
          return
        }

        const headerRowIndex = findHeaderRowIndex(aoa)
        const rawHeaders = aoa[headerRowIndex].map((h, i) => {
          const clean = String(h ?? '').trim()
          return clean || `Columna ${i + 1}`
        })

        const rows = aoa
          .slice(headerRowIndex + 1)
          .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
          .map((r) => {
            const obj: Record<string, any> = {}
            rawHeaders.forEach((h, i) => { obj[h] = r[i] ?? '' })
            return obj
          })

        if (!rows.length) {
          alert('No se encontraron filas de productos después de los encabezados')
          return
        }

        const headers = rawHeaders
        setImportHeaders(headers)
        setImportRows(rows)

        // Auto-detectar columnas como sugerencia (el usuario confirma/corrige después)
        const hints = importMode === 'recipes' ? RECIPE_AUTO_DETECT_HINTS : AUTO_DETECT_HINTS
        const mapping: Record<string, string> = {}
        for (const field of Object.keys(hints)) {
          const match = headers.find((h) =>
            hints[field].some((hint) => h.toLowerCase().trim().includes(hint))
          )
          if (match) mapping[field] = match
        }
        setColumnMapping(mapping)
        setImportStep('map')
      } catch (err: any) {
        alert('No se pudo leer el archivo: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleConfirmImport = async () => {
    if (importMode === 'recipes') {
      await handleConfirmRecipeImport()
    } else {
      await handleConfirmProductImport()
    }
  }

  const handleConfirmProductImport = async () => {
    if (!business || !importRows.length) return
    if (!columnMapping.name) {
      alert('Tenés que indicar cuál columna es el nombre del producto')
      return
    }
    const targetBranchId = selectedBranchId || (branches.length === 1 ? branches[0].id : null)
    if (!targetBranchId) {
      alert('Elegí una sucursal específica arriba (no "Todas las sucursales") antes de importar')
      return
    }

    setImporting(true)
    const skipped: string[] = []
    const toInsert: any[] = []

    importRows.forEach((row, i) => {
      const name = String(row[columnMapping.name] ?? '').trim()
      if (!name) {
        skipped.push(`Fila ${i + 2}: sin nombre, se omitió`)
        return
      }
      toInsert.push({
        business_id: business.id,
        branch_id: targetBranchId,
        name,
        price: columnMapping.price ? parseNumber(row[columnMapping.price]) : 0,
        cost: columnMapping.cost ? parseNumber(row[columnMapping.cost]) : 0,
        stock: columnMapping.stock ? parseNumber(row[columnMapping.stock]) : 0,
        unit: columnMapping.unit ? String(row[columnMapping.unit] || 'piezas').trim() : 'piezas',
        product_type: 'simple',
      })
    })

    let successCount = 0
    const chunkSize = 50
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize)
      const { error } = await supabase.from('products').insert(chunk)
      if (error) {
        chunk.forEach((p) => skipped.push(`${p.name}: ${error.message}`))
      } else {
        successCount += chunk.length
      }
    }

    setImportResult({ success: successCount, skipped })
    setImportStep('result')
    setImporting(false)
    await loadData()
  }

  const handleConfirmRecipeImport = async () => {
    if (!business || !importRows.length) return
    if (!columnMapping.recipe || !columnMapping.ingredient) {
      alert('Tenés que indicar cuál columna es la receta y cuál es el ingrediente')
      return
    }
    const targetBranchId = selectedBranchId || (branches.length === 1 ? branches[0].id : null)
    if (!targetBranchId) {
      alert('Elegí una sucursal específica arriba (no "Todas las sucursales") antes de importar')
      return
    }

    setImporting(true)
    const skipped: string[] = []

    // 1. Cargar los productos existentes de esa sucursal, para buscar ingredientes por nombre
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, name, product_type')
      .eq('business_id', business.id)
      .eq('branch_id', targetBranchId)
    const productByName = new Map<string, any>(
      (existingProducts || []).map((p) => [p.name.trim().toLowerCase(), p])
    )

    // 2. Agrupar las filas por nombre de receta
    const groups = new Map<string, any[]>()
    importRows.forEach((row) => {
      const recipeName = String(row[columnMapping.recipe] ?? '').trim()
      if (!recipeName) return
      if (!groups.has(recipeName)) groups.set(recipeName, [])
      groups.get(recipeName)!.push(row)
    })

    let successCount = 0

    for (const [recipeName, rows] of Array.from(groups.entries())) {
      // Buscar o crear el producto de tipo "receta"
      let recipeProduct = productByName.get(recipeName.toLowerCase())
      const price = columnMapping.price ? parseNumber(rows[0][columnMapping.price]) : 0

      if (recipeProduct && recipeProduct.product_type !== 'receta') {
        skipped.push(`${recipeName}: ya existe como producto simple, no se puede convertir en receta`)
        continue
      }

      if (!recipeProduct) {
        const { data: created, error } = await supabase
          .from('products')
          .insert({
            business_id: business.id,
            branch_id: targetBranchId,
            name: recipeName,
            price,
            stock: 0,
            unit: 'piezas',
            product_type: 'receta',
          })
          .select()
          .single()
        if (error || !created) {
          skipped.push(`${recipeName}: no se pudo crear (${error?.message})`)
          continue
        }
        recipeProduct = created
        productByName.set(recipeName.toLowerCase(), created)
      } else {
        // Ya existía la receta: actualizamos el precio y limpiamos sus ingredientes viejos
        await supabase.from('products').update({ price }).eq('id', recipeProduct.id)
        await supabase.from('recipe_items').delete().eq('product_id', recipeProduct.id)
      }

      // Insertar cada ingrediente de la receta
      const itemsToInsert: any[] = []
      for (const row of rows) {
        const ingredientName = String(row[columnMapping.ingredient] ?? '').trim()
        if (!ingredientName) continue

        const ingredientProduct = productByName.get(ingredientName.toLowerCase())
        if (!ingredientProduct) {
          skipped.push(`${recipeName}: ingrediente "${ingredientName}" no existe en tu inventario, importalo primero como producto`)
          continue
        }
        if (ingredientProduct.id === recipeProduct.id) {
          skipped.push(`${recipeName}: no puede ser ingrediente de sí misma`)
          continue
        }

        itemsToInsert.push({
          product_id: recipeProduct.id,
          ingredient_id: ingredientProduct.id,
          quantity: columnMapping.quantity ? parseNumber(row[columnMapping.quantity]) || 1 : 1,
          unit: columnMapping.unit ? String(row[columnMapping.unit] || '').trim() : null,
        })
      }

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from('recipe_items').insert(itemsToInsert)
        if (error) {
          skipped.push(`${recipeName}: error guardando ingredientes (${error.message})`)
        } else {
          successCount++
        }
      } else {
        skipped.push(`${recipeName}: no se le pudo agregar ningún ingrediente válido`)
      }
    }

    setImportResult({ success: successCount, skipped })
    setImportStep('result')
    setImporting(false)
    await loadData()
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
  const activeFields = importMode === 'recipes' ? RECIPE_FIELD_LABELS : FIELD_LABELS

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📦 Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => openImportModal('products')} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold border">
            📥 Importar Productos
          </button>
          <button onClick={() => openImportModal('recipes')} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold border">
            🍽️ Importar Recetas
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
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-9 h-9 object-cover rounded-lg border flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-sm flex-shrink-0">🍽️</div>
                        )}
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🍽️</span>
                      </div>
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
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-9 h-9 object-cover rounded-lg border flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-sm flex-shrink-0">📦</div>
                      )}
                      {p.name}
                      {p.category && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.category}</span>}
                    </div>
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

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editing ? '✏️ Editar' : '+ Nuevo'} {form.product_type === 'receta' ? 'Receta' : 'Producto'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Foto (aparece al cobrar)</label>
                {imagePreview ? (
                  <div className="relative w-28 h-28">
                    <img src={imagePreview} alt="Vista previa" className="w-28 h-28 object-cover rounded-xl border" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="w-28 h-28 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-500">
                    <span className="text-2xl">📷</span>
                    <span className="text-xs mt-1">Subir foto</span>
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  </label>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Nombre</label>
                <input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="w-full px-3 py-2 rounded-lg border" 
                  placeholder={form.product_type === 'receta' ? 'Ej: Licuado de Fresa' : 'Ej: Fresa'}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Categoría <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  placeholder="Ej: Comida, Extras, Frozen"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
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
              <button onClick={handleSave} disabled={uploadingImage} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50">
                {uploadingImage ? 'Subiendo foto...' : '💾 Guardar'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {importMode === 'recipes' ? '🍽️ Importar Recetas desde Excel' : '📥 Importar Productos desde Excel'}
            </h2>

            {importStep === 'upload' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Subí un archivo .xlsx o .csv. La primera fila debe tener los encabezados de columna (por ejemplo: Nombre, Precio, Stock).
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFile}
                  className="w-full px-3 py-2 rounded-lg border"
                />
              </div>
            )}

            {importStep === 'map' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Se encontraron <strong>{importRows.length}</strong> filas. Confirmá qué columna de tu archivo corresponde a cada campo (tratamos de adivinar, pero revisalo antes de continuar):
                </p>
                <div className="space-y-3 mb-4">
                  {Object.keys(activeFields).map((field) => (
                    <div key={field} className="flex items-center gap-3">
                      <label className="text-sm font-medium w-56">{activeFields[field]}</label>
                      <select
                        value={columnMapping[field] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg border"
                      >
                        <option value="">-- No importar este campo --</option>
                        {importHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="border rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {Object.keys(activeFields).map((field) => (
                          <th key={field} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">
                            {activeFields[field].split(' (')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importRows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {Object.keys(activeFields).map((field) => (
                            <td key={field} className="px-3 py-2">
                              {columnMapping[field] ? String(row[columnMapping[field]] ?? '') : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mb-4">Vista previa de las primeras 5 filas. Si no se ve como esperabas, ajustá el mapeo de columnas arriba.</p>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
                  >
                    {importing ? 'Importando...' : `✅ Importar ${importRows.length} filas`}
                  </button>
                  <button onClick={() => setImportStep('upload')} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">
                    Volver
                  </button>
                </div>
              </div>
            )}

            {importStep === 'result' && (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="font-semibold text-green-700">
                    ✅ {importResult.success} {importMode === 'recipes' ? 'recetas importadas' : 'productos importados'} correctamente
                  </p>
                </div>
                {importResult.skipped.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
                    <p className="font-semibold text-yellow-700 mb-2">⚠️ {importResult.skipped.length} filas con problemas:</p>
                    <ul className="text-sm text-yellow-700 list-disc pl-5 space-y-1">
                      {importResult.skipped.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => setShowImportModal(false)}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            )}

            {importStep !== 'result' && (
              <button
                onClick={() => setShowImportModal(false)}
                className="w-full mt-3 py-2 text-gray-500 text-sm font-semibold"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
