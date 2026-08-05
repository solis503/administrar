export const PLAN_PRICES = {
  monthly: 15,
  annual: 162, // $15 x 12 = $180, con 10% de descuento
} as const

export type PlanType = 'monthly' | 'annual'

export type SubscriptionStatus = {
  blocked: boolean
  exempt: boolean
  onTrial: boolean
  trialDaysLeft: number
  plan: 'trial' | 'monthly' | 'annual'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  hasPendingSubmission: boolean
  label: string
}

export function computeSubscriptionStatus(
  subscription: { plan: string; trial_ends_at: string | null; current_period_end: string | null } | null,
  isExempt: boolean,
  hasPendingSubmission: boolean
): SubscriptionStatus {
  const now = new Date()

  if (isExempt) {
    return {
      blocked: false, exempt: true, onTrial: false, trialDaysLeft: 0,
      plan: (subscription?.plan as any) || 'monthly',
      trialEndsAt: subscription?.trial_ends_at || null,
      currentPeriodEnd: subscription?.current_period_end || null,
      hasPendingSubmission: false,
      label: 'Cuenta del propietario (sin costo)',
    }
  }

  if (!subscription) {
    return {
      blocked: true, exempt: false, onTrial: false, trialDaysLeft: 0,
      plan: 'trial', trialEndsAt: null, currentPeriodEnd: null,
      hasPendingSubmission, label: 'Sin suscripción activa',
    }
  }

  // Plan de pago activo
  if (subscription.plan !== 'trial' && subscription.current_period_end) {
    const end = new Date(subscription.current_period_end)
    if (end > now) {
      return {
        blocked: false, exempt: false, onTrial: false, trialDaysLeft: 0,
        plan: subscription.plan as any, trialEndsAt: subscription.trial_ends_at,
        currentPeriodEnd: subscription.current_period_end,
        hasPendingSubmission, label: subscription.plan === 'annual' ? 'Plan Anual activo' : 'Plan Mensual activo',
      }
    }
  }

  // Trial
  if (subscription.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at)
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
      return {
        blocked: false, exempt: false, onTrial: true, trialDaysLeft: daysLeft,
        plan: 'trial', trialEndsAt: subscription.trial_ends_at,
        currentPeriodEnd: subscription.current_period_end,
        hasPendingSubmission, label: `Prueba gratis — ${daysLeft} día${daysLeft === 1 ? '' : 's'} restante${daysLeft === 1 ? '' : 's'}`,
      }
    }
  }

  // Vencido
  return {
    blocked: true, exempt: false, onTrial: false, trialDaysLeft: 0,
    plan: subscription.plan as any, trialEndsAt: subscription.trial_ends_at,
    currentPeriodEnd: subscription.current_period_end,
    hasPendingSubmission,
    label: hasPendingSubmission ? 'Comprobante en revisión' : 'Suscripción vencida',
  }
}
