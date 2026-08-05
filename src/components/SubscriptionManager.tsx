'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { PLAN_PRICES, PlanType, SubscriptionStatus } from '@/lib/subscription'

export default function SubscriptionManager({
  status,
  businessId,
  isOwner,
  blockedView = false,
}: {
  status: SubscriptionStatus
  businessId: string
  isOwner: boolean
  blockedView?: boolean
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    setError('')
    if (!file) { setError('Subí una foto o captura del comprobante de pago'); return }
    setSubmitting(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${businessId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, file)
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('payment_submissions').insert({
        business_id: businessId,
        plan: selectedPlan,
        amount: PLAN_PRICES[selectedPlan],
        proof_url: path,
        status: 'pending',
      })
      if (insertError) throw insertError

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al subir el comprobante')
    } finally {
      setSubmitting(false)
    }
  }

  if (status.exempt) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-center">
        <p className="text-4xl mb-2">👑</p>
        <p className="font-semibold text-gray-900">Cuenta del propietario</p>
        <p className="text-sm text-gray-500 mt-1">Esta cuenta no paga suscripción.</p>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-center">
        <p className="text-4xl mb-2">🔒</p>
        <p className="font-semibold text-gray-900">Suscripción vencida</p>
        <p className="text-sm text-gray-500 mt-1">Pedile al dueño del negocio que renueve la suscripción para poder seguir usando FlowStock.</p>
      </div>
    )
  }

  if (success || status.hasPendingSubmission) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-center">
        <p className="text-4xl mb-2">⏳</p>
        <p className="font-semibold text-gray-900">Comprobante en revisión</p>
        <p className="text-sm text-gray-500 mt-1">Ya recibimos tu comprobante. En cuanto lo aprobemos vas a tener acceso completo de nuevo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!blockedView && (
        <div className="bg-white rounded-2xl border p-5">
          <p className="text-xs text-gray-500">Estado actual</p>
          <p className="font-semibold text-gray-900">{status.label}</p>
        </div>
      )}

      {blockedView && (
        <div className="text-center mb-2">
          <p className="text-4xl mb-2">🔒</p>
          <h2 className="font-bold text-lg text-gray-900">Tu suscripción venció</h2>
          <p className="text-sm text-gray-500 mt-1">Elegí un plan y subí tu comprobante de pago para reactivar tu cuenta.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSelectedPlan('monthly')}
          className={`text-left p-4 rounded-2xl border-2 transition ${selectedPlan === 'monthly' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
        >
          <p className="text-xs font-semibold text-gray-500">Mensual</p>
          <p className="text-2xl font-bold text-gray-900">${PLAN_PRICES.monthly}<span className="text-sm font-normal text-gray-400">/mes</span></p>
        </button>
        <button
          onClick={() => setSelectedPlan('annual')}
          className={`text-left p-4 rounded-2xl border-2 transition relative ${selectedPlan === 'annual' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
        >
          <span className="absolute -top-2 right-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">-10%</span>
          <p className="text-xs font-semibold text-gray-500">Anual</p>
          <p className="text-2xl font-bold text-gray-900">${PLAN_PRICES.annual}<span className="text-sm font-normal text-gray-400">/año</span></p>
        </button>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Realizá la transferencia y subí el comprobante</p>
        <p className="text-xs text-gray-500">Monto a pagar: <span className="font-semibold text-gray-700">${PLAN_PRICES[selectedPlan]}</span></p>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:font-semibold"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {submitting ? 'Enviando...' : 'Enviar comprobante'}
        </button>
      </div>
    </div>
  )
}
