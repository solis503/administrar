'use client'
import { usePathname } from 'next/navigation'
import { SubscriptionStatus } from '@/lib/subscription'
import SubscriptionManager from './SubscriptionManager'

export default function SubscriptionGate({
  status,
  businessId,
  isOwner,
  children,
}: {
  status: SubscriptionStatus
  businessId: string
  isOwner: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isSubscriptionPage = pathname === '/subscription'

  if (status.blocked && !isSubscriptionPage) {
    return (
      <div className="max-w-md mx-auto py-10">
        <SubscriptionManager status={status} businessId={businessId} isOwner={isOwner} blockedView />
      </div>
    )
  }

  return <>{children}</>
}
