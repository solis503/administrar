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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar el perfil del usuario (NO asumir que es owner)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, businesses(*)')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  let userRole = 'seller'
  let businessData: any = null

  if (profile) {
    userRole = profile.role
    businessData = profile.businesses
  } else {
    // Si no tiene perfil, buscar si es owner directo
    const { data: ownerBiz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .single()
    
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
    .single()

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userName={user.email || 'Usuario'}
        businessName={businessData?.name || 'Mi Negocio'}
        userRole={userRole}
        isPlatformAdmin={!!adminProfile}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <BusinessProvider>
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
        </BusinessProvider>
      </main>
    </div>
  )
}
