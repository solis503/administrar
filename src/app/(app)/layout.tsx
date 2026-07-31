import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userName={user.email || 'Usuario'}
        businessName={businessData?.name || 'Mi Negocio'}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
