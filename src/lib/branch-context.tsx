'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from './supabase-client'

type Branch = { id: string; name: string; active?: boolean }

type BranchContextType = {
  branches: Branch[]
  selectedBranchId: string | null // null = "todas las sucursales" (solo dueño)
  setSelectedBranchId: (id: string | null) => void
  canSwitchBranches: boolean
  loading: boolean
  refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextType | null>(null)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null)
  const [canSwitchBranches, setCanSwitchBranches] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const isOwner = !profile || profile.role === 'owner'
    setCanSwitchBranches(isOwner)

    const { data: branchList } = await supabase.from('branches').select('id, name, active').eq('active', true).order('name')
    setBranches(branchList || [])

    const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedBranchId') : null

    if (isOwner) {
      // Dueño: puede ver "todas" (null) o una en particular. Respetamos lo que tenía elegido.
      const stillExists = stored && (branchList || []).some((b) => b.id === stored)
      setSelectedBranchIdState(stillExists ? stored : null)
    } else {
      // Empleado: fijo a su sucursal asignada, sin importar lo que hubiera guardado
      setSelectedBranchIdState(profile?.branch_id || null)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const setSelectedBranchId = (id: string | null) => {
    if (!canSwitchBranches) return
    setSelectedBranchIdState(id)
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('selectedBranchId', id)
      else localStorage.removeItem('selectedBranchId')
    }
  }

  return (
    <BranchContext.Provider value={{ branches, selectedBranchId, setSelectedBranchId, canSwitchBranches, loading, refreshBranches: load }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch debe usarse dentro de <BranchProvider>')
  return ctx
}
