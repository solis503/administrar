'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { translations, type Lang } from '@/lib/i18n'

export default function LoginPage() {
  const [tab, setTab] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<Lang>('es')
  const router = useRouter()
  const supabase = createClient()
  const t = translations[lang]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const loginEmail = tab === 'phone' ? phone : email
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={() => setLang('es')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${lang === 'es' ? 'bg-white text-blue-700' : 'bg-white/20 text-white'}`}>🇪🇸 ES</button>
        <button onClick={() => setLang('en')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${lang === 'en' ? 'bg-white text-blue-700' : 'bg-white/20 text-white'}`}>🇺🇸 EN</button>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t.appName}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t.tagline}</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-2 mb-6">
          <button onClick={() => setTab('email')} className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${tab === 'email' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>{t.emailTab}</button>
          <button onClick={() => setTab('phone')} className={`py-2.5 rounded-xl text-sm font-semibold border-2 ${tab === 'phone' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>{t.phoneTab}</button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {tab === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="tu@email.com" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.phone}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder={t.phonePlaceholder} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">
            {loading ? '...' : t.submit}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6 text-sm">
          {t.noAccount} <Link href="/register" className="text-blue-600 font-bold">{t.register}</Link>
        </p>
      </div>
    </div>
  )
}
