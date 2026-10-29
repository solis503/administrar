import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { BranchProvider } from '@/lib/branch-context'
import BranchSelector from '@/components/BranchSelector'
import SubscriptionGate from '@/components/SubscriptionGate'
import TrialWarningBanner from '@/components/TrialWarningBanner'
import { computeSubscriptionStatus } from '@/lib/subscription'
import { BusinessProvider } from '@/lib/business-context'

export const dynamic = 'force-dynamic'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Un error de red / Supabase "despertando" NO significa que la sesión se perdió.
function isTransient(error: any) {
  if (!error) return false
  if (error.code === 'PGRST116') return false
  const status = error.status
  if (error.name === 'AuthRetryableFetchError') return true
  if (status === undefined || status === 0 || status >= 500) return true
  return typeof error.code !== 'string' || error.code.length === 0 || /^(5|08|57|53)/.test(error.code)
}

async function retry<R extends { error: any }>(fn: () => PromiseLike<R>, tries = 3): Promise<R> {
  let res = await fn()
  for (let i = 1; i < tries && res.error && isTransient(res.error); i++) {
    await wait(700 * i)
    res = await fn()
  }
  return res
}

function Reconnecting() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">📡</div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Reconectando...</h1>
        <p className="text-sm text-gray-500 mb-5">
          La conexión con el servidor tardó más de lo normal. Tu sesión sigue activa.
        </p>
        <a href="/dashboard" className="inline-block px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl">
          Reintentar
        </a>
      </div>
    </div>
  )
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase()
  const userRes = await retry(() => supabase.auth.getUser())
  const user = userRes.data?.user
  if (!user) {
    // Solo mandamos al login si de verdad no hay sesión; un fallo de red no cierra la sesión.
    if (userRes.error && isTransient(userRes.error)) return <Reconnecting />
    redirect('/login')
  }

  // Buscar el perfil del usuario (NO asumir que es owner)
  const { data: profile, error: profileError } = await retry(() =>
    supabase
      .from('profiles')
      .select('*, businesses(*)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
  )
  if (profileError) return <Reconnecting />

  let userRole = 'seller'
  let businessData: any = null

  if (profile) {
    userRole = profile.role
    businessData = profile.businesses
  } else {
    // Si no tiene perfil, buscar si es owner directo
    const { data: ownerBiz, error: ownerError } = await retry(() =>
      supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()
    )
    if (ownerError) return <Reconnecting />

    if (ownerBiz) {
      userRole = 'owner'
      businessData = ownerBiz
    } else {
      redirect('/login')
    }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, trial_ends_at, current_period_end')
    .eq('business_id', businessData.id)
    .maybeSingle()

  const { count: pendingCount } = await supabase
    .from('payment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessData.id)
    .eq('status', 'pending')

  const subStatus = computeSubscriptionStatus(
    subscription,
    !!businessData.is_subscription_exempt,
    (pendingCount || 0) > 0
  )

  const { data: adminProfile } = await supabase
    .from('profiles').select('is_platform_admin').eq('user_id', user.id).eq('is_platform_admin', true).maybeSingle()

  return (
    <BusinessProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          userName={user.email || 'Usuario'}
          initialBusinessName={businessData?.name || 'Mi Negocio'}
          userRole={userRole}
          isPlatformAdmin={!!adminProfile}
          enableOpenOrders={!!businessData?.enable_open_orders}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <BranchProvider>
            <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
              <div className="mb-4">
                <BranchSelector />
              </div>
              <TrialWarningBanner status={subStatus} isOwner={userRole === 'owner'} />
              <SubscriptionGate status={subStatus} businessId={businessData.id} isOwner={userRole === 'owner'}>
                {children}
              </SubscriptionGate>
            </div>
          </BranchProvider>
        </main>
      </div>
    </BusinessProvider>
  )
}
