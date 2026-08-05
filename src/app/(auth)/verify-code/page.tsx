'use client'
import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyCodeForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'recovery',
    })

    setLoading(false)
    if (error) {
      console.error('Error al verificar código:', error)
      setError(
        typeof error.message === 'string' && error.message
          ? (error.message === 'Token has expired or is invalid' ? 'El código es incorrecto o ya venció. Pedí uno nuevo.' : error.message)
          : 'No se pudo verificar el código. Intentá de nuevo.'
      )
    } else {
      router.push('/reset-password')
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setResending(false)
    if (error) {
      setError('No se pudo reenviar el código. Intentá de nuevo en un momento.')
    } else {
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          <p className="text-gray-600 mb-4">Primero pedí el código de recuperación con tu correo.</p>
          <Link href="/forgot-password" className="text-blue-600 font-bold">Ir a recuperar contraseña</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">✉️ Verificá tu código</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Te mandamos un código de 6 dígitos a <strong>{email}</strong>. Revisá también la carpeta de spam.
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
        {resent && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">Código reenviado.</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de verificación</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-[0.5em] font-bold"
              placeholder="000000"
            />
          </div>
          <button type="submit" disabled={loading || code.length !== 6} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">
            {loading ? '...' : 'Verificar código'}
          </button>
        </form>

        <button onClick={handleResend} disabled={resending} className="block w-full text-center text-blue-600 font-semibold text-sm mt-6 disabled:opacity-50">
          {resending ? 'Enviando...' : '¿No te llegó? Reenviar código'}
        </button>
        <Link href="/login" className="block text-center text-gray-500 text-sm mt-3">← Volver a iniciar sesión</Link>
      </div>
    </div>
  )
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={null}>
      <VerifyCodeForm />
    </Suspense>
  )
}
