'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Submission = {
  id: string
  business_id: string
  plan: string
  amount: number
  status: string
  submitted_at: string
  signed_url: string | null
  businesses: { name: string } | null
}

export default function AdminSubmissionsList({ submissions }: { submissions: Submission[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()

  const review = async (submission_id: string, action: 'approve' | 'reject') => {
    setLoadingId(submission_id)
    try {
      const res = await fetch('/api/subscriptions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Error al procesar')
    } finally {
      setLoadingId(null)
    }
  }

  const pending = submissions.filter(s => s.status === 'pending')
  const reviewed = submissions.filter(s => s.status !== 'pending')

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-semibold mb-3 text-gray-700">Pendientes ({pending.length})</h2>
        {pending.length === 0 && <p className="text-gray-400 text-sm">No hay comprobantes pendientes.</p>}
        <div className="space-y-3">
          {pending.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[160px]">
                <p className="font-semibold text-gray-900">{s.businesses?.name || 'Negocio'}</p>
                <p className="text-xs text-gray-500">
                  Plan {s.plan === 'annual' ? 'Anual' : 'Mensual'} · ${Number(s.amount).toFixed(2)} · {new Date(s.submitted_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {s.signed_url && (
                <a href={s.signed_url} target="_blank" rel="noreferrer" className="text-sm text-primary-600 font-semibold underline">
                  Ver comprobante
                </a>
              )}
              <div className="flex gap-2">
                <button
                  disabled={loadingId === s.id}
                  onClick={() => review(s.id, 'approve')}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  ✅ Aprobar
                </button>
                <button
                  disabled={loadingId === s.id}
                  onClick={() => review(s.id, 'reject')}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  ✕ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3 text-gray-700">Historial</h2>
        <div className="space-y-2">
          {reviewed.map(s => (
            <div key={s.id} className="bg-white rounded-xl border p-3 flex items-center justify-between text-sm">
              <span>{s.businesses?.name || 'Negocio'} — {s.plan === 'annual' ? 'Anual' : 'Mensual'} — ${Number(s.amount).toFixed(2)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {s.status === 'approved' ? 'Aprobado' : 'Rechazado'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
