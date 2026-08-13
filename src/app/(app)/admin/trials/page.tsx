import { createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import TrialCountdownList from '@/components/TrialCountdownList'

export const dynamic = 'force-dynamic'

export default async function AdminTrialsPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase
    .from('profiles').select('is_platform_admin').eq('user_id', user.id).eq('is_platform_admin', true).maybeSingle()

  if (!adminProfile) redirect('/dashboard')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: subs } = await admin
    .from('subscriptions')
    .select('business_id, trial_ends_at, businesses(id, name, is_subscription_exempt)')
    .eq('plan', 'trial')

  const { data: owners } = await admin.from('profiles').select('business_id, email').eq('role', 'owner')
  const emailByBusiness = Object.fromEntries((owners || []).map((o: any) => [o.business_id, o.email]))

  const trials = (subs || [])
    .map((s: any) => {
      const biz = Array.isArray(s.businesses) ? s.businesses[0] : s.businesses
      if (!biz || biz.is_subscription_exempt || !s.trial_ends_at) return null
      return {
        businessId: biz.id,
        name: biz.name,
        email: emailByBusiness[biz.id] || '—',
        trialEndsAt: s.trial_ends_at,
      }
    })
    .filter(Boolean) as { businessId: string; name: string; email: string; trialEndsAt: string }[]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">⏳ Pruebas Gratis</h1>
      <p className="text-sm text-gray-500 mb-6">Cuenta regresiva exacta de cada negocio que está en su período de prueba de 7 días. Se actualiza cada segundo.</p>
      <TrialCountdownList trials={trials} />
    </div>
  )
}
