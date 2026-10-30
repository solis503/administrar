import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// La raíz ("/") es la que abre el ícono de la app instalada.
// Si ya hay sesión, va directo al dashboard; si no, al login.
// (El layout del dashboard vuelve a validar la sesión con getUser.)
export default async function Home() {
  const supabase = createServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  redirect(session ? '/dashboard' : '/login')
}
