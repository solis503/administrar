import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { email, password, full_name, role, permissions } = await req.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const supabase = createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (bizError || !business) {
      return NextResponse.json({ error: 'No se encontró un negocio para este usuario' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'No se pudo crear el usuario' },
        { status: 400 }
      )
    }

    // El trigger `handle_new_user` de la base de datos crea automáticamente un
    // negocio + sucursal + perfil "owner" para CUALQUIER usuario nuevo (pensado
    // para cuando un dueño se registra solo). Como este endpoint crea empleados,
    // hay que deshacer eso antes de insertar el perfil correcto del empleado.
    const { data: phantomProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, business_id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (phantomProfile) {
      await supabaseAdmin.from('profiles').delete().eq('id', phantomProfile.id)
      await supabaseAdmin.from('branches').delete().eq('business_id', phantomProfile.business_id)
      await supabaseAdmin.from('businesses').delete().eq('id', phantomProfile.business_id)
    }

    // Crear el perfil real del empleado, en el negocio del dueño que hizo la petición
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      user_id: authData.user.id,
      business_id: business.id,
      role,
      full_name,
      email,
      active: true,
      permissions,
    })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
