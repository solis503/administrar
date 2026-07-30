'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', category: '' })
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
      const { data } = await supabase.from('suppliers').select('*').eq('business_id', biz.id).eq('active', true).order('name')
      setSuppliers(data || [])
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name || !business) return
    await supabase.from('suppliers').insert({ ...form, business_id: business.id })
    setForm({ name: '', contact: '', phone: '', email: '', category: '' })
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar proveedor?')) return
    await supabase.from('suppliers').update({ active: false }).eq('id', id)
    loadData()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⏳</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🚚 Proveedores</h1>
        <button onClick={() => setShowForm(true)} className="bg-primary-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">+ Nuevo Proveedor</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-semibold">{s.name}</h3><p className="text-sm text-gray-500">{s.category || 'General'}</p></div>
              <span className="text-2xl">🚚</span>
            </div>
            <div className="space-y-1 text-sm">
              {s.contact_person && <p className="text-gray-600">👤 {s.contact_person}</p>}
              {s.phone && <p className="text-gray-600">📞 {s.phone}</p>}
              {s.email && <p className="text-gray-600">✉️ {s.email}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold">📋 Orden</button>
              <button onClick={() => handleDelete(s.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm">🗑️</button>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && <div className="col-span-full text-center py-12 text-gray-400"><p className="text-4xl mb-3">🚚</p>No hay proveedores aún</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">🚚 Nuevo Proveedor</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Nombre del proveedor *" />
              <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Persona de contacto" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Teléfono" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Email" />
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Categoría" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl">✅ Agregar</button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 rounded-xl font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
