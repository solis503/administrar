import { createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminSubmissionsList from '@/components/AdminSubmissionsList'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('is_platform_admin').eq('user_id', user.id).eq('is_platform_admin', true).maybeSingle()

  if (!profile) redirect('/dashboard')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: submissions } = await admin
    .from('payment_submissions')
    .select('*, businesses(name)')
    .order('submitted_at', { ascending: false })

  const withUrls = await Promise.all((submissions || []).map(async (s: any) => {
    const { data } = await admin.storage.from('payment-proofs').createSignedUrl(s.proof_url, 3600)
    return { ...s, signed_url: data?.signedUrl || null }
  }))

  // Negocios que vencen pronto (dentro de 7 días), para que puedas contactarlos antes de que se corten
  const { data: subs } = await admin
    .from('subscriptions')
    .select('business_id, plan, trial_ends_at, current_period_end, businesses(id, name, is_subscription_exempt)')

  const { data: owners } = await admin.from('profiles').select('business_id, email').eq('role', 'owner')
  const emailByBusiness = Object.fromEntries((owners || []).map((o: any) => [o.business_id, o.email]))

  const now = Date.now()
  const upcoming = (subs || [])
    .map((s: any) => {
      const biz = s.businesses
      if (!biz || biz.is_subscription_exempt) return null
      const relevantDate = s.plan !== 'trial' && s.current_period_end ? s.current_period_end : s.trial_ends_at
      if (!relevantDate) return null
      const daysLeft = Math.ceil((new Date(relevantDate).getTime() - now) / 86400000)
      return { businessId: biz.id, name: biz.name, email: emailByBusiness[biz.id] || '—', plan: s.plan, daysLeft }
    })
    .filter((x: any) => x && x.daysLeft <= 7)
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🛠️ Comprobantes de Suscripción</h1>

      <div className="mb-8">
        <h2 className="font-semibold mb-3 text-gray-700">⏳ Próximos a vencer (7 días)</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-400 text-sm">Ningún negocio vence pronto.</p>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Negocio</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Correo del dueño</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Plan</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Vence en</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {upcoming.map((u: any) => (
                  <tr key={u.businessId}>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">{u.plan === 'trial' ? 'Prueba gratis' : u.plan === 'annual' ? 'Anual' : 'Mensual'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.daysLeft <= 0 ? 'bg-red-100 text-red-700' : u.daysLeft <= 2 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                        {u.daysLeft <= 0 ? 'Vencido' : `${u.daysLeft} día${u.daysLeft === 1 ? '' : 's'}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminSubmissionsList submissions={withUrls} />
    </div>
  )
}
