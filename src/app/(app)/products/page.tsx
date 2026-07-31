'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import * as XLSX from 'xlsx'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', price: '', stock: '', unit: 'piezas' })
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

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', price: '', stock: '', unit: 'piezas' })
    setShowForm(true)
  }

  const openEdit = (product: any) => {
    setEditing(product)
    setForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      unit: product.unit,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !business) return
    
    if (editing) {
      await supabase.from('products').update({
        name: form.name,
        price: parseFloat(form.price) || 0,
        stock: parseFloat(form.stock) || 0,
        unit: form.unit,
      }).eq('id', editing.id)
    } else {
      await supabase.from('products').insert({
        business_id: business.id,
        name: form.name,
        price: parseFloat(form.price) || 0,
        stock: parseFloat(form.stock) || 0,
        unit: form.unit,
      })
    }
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('products').delete().eq('id', id)
    loadData()
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📦 Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-purple-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            📥 Importar
          </button>
          <button onClick={openCreate} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            + Producto
          </button>
        </div>
      </div>

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
            {products.map(p => (
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

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              {editing ? '✏️ Editar' : '+ Nuevo'} Producto
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Nombre</label>
                <input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="w-full px-3 py-2 rounded-lg border" 
                />
              </div>
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
                <label className="text-sm font-medium block mb-1">Stock</label>
                <input 
                  type="number" 
                  value={form.stock} 
                  onChange={(e) => setForm({ ...form, stock: e.target.value })} 
                  className="w-full px-3 py-2 rounded-lg border" 
                />
              </div>
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
