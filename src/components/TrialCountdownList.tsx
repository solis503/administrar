'use client'
import { useEffect, useState } from 'react'

type TrialRow = {
  businessId: string
  name: string
  email: string
  trialEndsAt: string
}

function formatRemaining(ms: number) {
  if (ms <= 0) {
    const overdue = Math.abs(ms)
    const h = Math.floor(overdue / 3600000)
    const m = Math.floor((overdue % 3600000) / 60000)
    return { text: `Vencida hace ${h}h ${m}m`, overdue: true, days: 0, hours: h, minutes: m, seconds: 0 }
  }
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const text = days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m ${seconds}s`
  return { text, overdue: false, days, hours, minutes, seconds }
}

export default function TrialCountdownList({ trials }: { trials: TrialRow[] }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const sorted = [...trials].sort(
    (a, b) => new Date(a.trialEndsAt).getTime() - new Date(b.trialEndsAt).getTime()
  )

  if (sorted.length === 0) {
    return <p className="text-gray-400 text-sm">Ningún negocio está en prueba gratis ahorita.</p>
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Negocio</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Correo del dueño</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Vence el</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Tiempo restante</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((t) => {
            const ms = new Date(t.trialEndsAt).getTime() - now
            const r = formatRemaining(ms)
            const urgent = !r.overdue && r.days === 0 && r.hours < 6
            return (
              <tr key={t.businessId}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.email}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(t.trialEndsAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.overdue ? 'bg-red-100 text-red-700' : urgent ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.text}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
