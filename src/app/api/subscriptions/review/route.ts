import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { submission_id, action } = await req.json()

    if (!submission_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const supabase = createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_platform_admin').eq('user_id', user.id).eq('is_platform_admin', true).maybeSingle()

    if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: submission, error: subError } = await admin
      .from('payment_submissions').select('*').eq('id', submission_id).single()

    if (subError || !submission) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
    if (submission.status !== 'pending') return NextResponse.json({ error: 'Este comprobante ya fue revisado' }, { status: 400 })

    if (action === 'reject') {
      await admin.from('payment_submissions').update({
        status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id,
      }).eq('id', submission_id)
      return NextResponse.json({ ok: true })
    }

    // Aprobar: extender el período desde hoy (o desde el vencimiento actual si todavía no vence)
    const { data: currentSub } = await admin
      .from('subscriptions').select('current_period_end').eq('business_id', submission.business_id).single()

    const now = new Date()
    const base = currentSub?.current_period_end && new Date(currentSub.current_period_end) > now
      ? new Date(currentSub.current_period_end)
      : now

    const days = submission.plan === 'annual' ? 365 : 30
    const newPeriodEnd = new Date(base.getTime() + days * 86400000)

    await admin.from('subscriptions').update({
      plan: submission.plan,
      current_period_end: newPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('business_id', submission.business_id)

    await admin.from('payment_submissions').update({
      status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id,
    }).eq('id', submission_id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error inesperado' }, { status: 500 })
  }
}
