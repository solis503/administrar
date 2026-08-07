'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from './supabase-client'

type BusinessContextType = {
  userId: string | null
  business: any | null
  profile: any | null
  role: string
  isOwner: boolean
  isPlatformAdmin: boolean
  loading: boolean
  refreshBusiness: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextType | null>(null)

/**
 * Carga el negocio, el perfil y el rol del usuario UNA sola vez (cuando entra a la app),
 * y lo comparte con todas las pantallas. Antes, cada módulo (Dashboard, POS, Productos,
 * Inventario, Reportes) volvía a preguntarle esto mismo a Supabase cada vez que se
 * navegaba a él, lo que hacía sentir la app lenta al cambiar de sección.
 */
export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [business, setBusiness] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [role, setRole] = useState('seller')
  const [isOwner, setIsOwner] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUserId(null)
      setBusiness(null)
      setProfile(null)
      setLoading(false)
      return
    }
    setUserId(user.id)

    // 1) ¿Es el dueño? (tiene un negocio con owner_id = su propio id)
    const { data: ownerBiz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()

    if (ownerBiz) {
      setBusiness(ownerBiz)
      setRole('owner')
      setIsOwner(true)

      // El dueño también puede tener un perfil (ej. para el flag de admin de la plataforma)
      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('business_id', ownerBiz.id)
        .maybeSingle()
      setProfile(ownProfile || null)
      setIsPlatformAdmin(!!ownProfile?.is_platform_admin)
    } else {
      // 2) No es dueño: buscamos su perfil de empleado
      const { data: pr } = await supabase
        .from('profiles')
        .select('*, businesses(*)')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (pr) {
        const biz = Array.isArray(pr.businesses) ? pr.businesses[0] : pr.businesses
        setBusiness(biz || null)
        setProfile(pr)
        setRole(pr.role || 'seller')
        setIsOwner(pr.role === 'owner')
        setIsPlatformAdmin(!!pr.is_platform_admin)
      } else {
        setBusiness(null)
        setProfile(null)
        setRole('seller')
        setIsOwner(false)
        setIsPlatformAdmin(false)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <BusinessContext.Provider value={{ userId, business, profile, role, isOwner, isPlatformAdmin, loading, refreshBusiness: load }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness debe usarse dentro de <BusinessProvider>')
  return ctx
}
