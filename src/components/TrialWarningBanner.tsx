'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { SubscriptionStatus } from '@/lib/subscription'

export default function TrialWarningBanner({ status, isOwner }: { status: SubscriptionStatus; isOwner: boolean }) {
  const [dismissed, setDismissed] = useState(false)

  if (status.exempt || status.blocked || dismissed) return null
  if (!status.onTrial || status.trialDaysLeft > 2) return null

  return (
    <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm font-medium">
        ⏳ Tu prueba gratis {status.trialDaysLeft === 0 ? 'termina hoy' : `termina en ${status.trialDaysLeft} día${status.trialDaysLeft === 1 ? '' : 's'}`}.
        {isOwner ? ' Pagá ahora para no perder acceso.' : ' Avisale al dueño del negocio.'}
      </p>
      <div className="flex items-center gap-3 flex-shrink-0">
        {isOwner && (
          <Link href="/subscription" className="text-sm font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700">
            Pagar ahora
          </Link>
        )}
        <button onClick={() => setDismissed(true)} className="text-amber-600 text-lg leading-none">✕</button>
      </div>
    </div>
  )
}
