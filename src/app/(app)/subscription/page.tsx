import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { computeSubscriptionStatus } from '@/lib/subscription'
import SubscriptionManager from '@/components/SubscriptionManager'

export const dynamic = 'force-dynamic'

export default async function SubscriptionPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*, businesses(*)').eq('user_id', user.id).eq('active', true).single()

  let business = profile?.businesses
  let isOwner = profile?.role === 'owner'

  if (!business) {
    const { data: ownerBiz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    business = ownerBiz
    isOwner = true
  }
  if (!business) redirect('/login')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, trial_ends_at, current_period_end')
    .eq('business_id', business.id)
    .single()

  const { count: pendingCount } = await supabase
    .from('payment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .eq('status', 'pending')

  const status = computeSubscriptionStatus(subscription, !!business.is_subscription_exempt, (pendingCount || 0) > 0)

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">💳 Suscripción</h1>
      <SubscriptionManager status={status} businessId={business.id} isOwner={isOwner} />
    </div>
  )
}
