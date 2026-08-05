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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🛠️ Comprobantes de Suscripción</h1>
      <AdminSubmissionsList submissions={withUrls} />
    </div>
  )
}
