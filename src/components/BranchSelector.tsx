'use client'
import { useBranch } from '@/lib/branch-context'

export default function BranchSelector() {
  const { branches, selectedBranchId, setSelectedBranchId, canSwitchBranches, loading } = useBranch()

  if (loading) return null

  if (!canSwitchBranches) {
    // Empleado: solo mostramos en qué sucursal está trabajando, sin poder cambiarla
    const current = branches.find((b) => b.id === selectedBranchId)
    if (!current) return null
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold w-fit">
        🏬 {current.name}
      </div>
    )
  }

  return (
    <select
      value={selectedBranchId || 'all'}
      onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? null : e.target.value)}
      className="px-3 py-1.5 rounded-xl border bg-white text-sm font-semibold text-gray-700 w-fit"
    >
      <option value="all">🏬 Todas las sucursales</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  )
}
