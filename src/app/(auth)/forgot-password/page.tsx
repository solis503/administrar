'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">🔒 Recuperar contraseña</h1>

        {sent ? (
          <div>
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
              Te enviamos un correo a <strong>{email}</strong> con un link para crear una nueva contraseña. Revisá también la carpeta de spam.
            </div>
            <Link href="/login" className="block text-center text-blue-600 font-bold mt-4">Volver a iniciar sesión</Link>
          </div>
        ) : (
          <>
            <p className="text-gray-500 mb-6 text-sm">Escribí tu correo y te mandamos un link para crear una nueva contraseña.</p>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="tu@email.com" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">
                {loading ? '...' : 'Enviar link de recuperación'}
              </button>
            </form>
            <Link href="/login" className="block text-center text-gray-500 text-sm mt-6">← Volver a iniciar sesión</Link>
          </>
        )}
      </div>
    </div>
  )
}
