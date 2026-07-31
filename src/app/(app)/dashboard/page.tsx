export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">📊 Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Ventas de Hoy</p>
          <p className="text-3xl font-bold text-blue-600">$0.00</p>
          <p className="text-xs text-gray-400 mt-1">0 transacciones</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Gastos de Hoy</p>
          <p className="text-3xl font-bold text-red-500">$0.00</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Ganancia</p>
          <p className="text-3xl font-bold text-green-600">$0.00</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Alertas Stock</p>
          <p className="text-3xl font-bold text-amber-600">0</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b"><h2 className="font-semibold">⚠️ Stock Bajo</h2></div>
          <div className="p-4 text-center text-gray-400 py-8">Sin productos aún</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b"><h2 className="font-semibold">🧾 Últimas Ventas</h2></div>
          <div className="p-4 text-center text-gray-400 py-8">No hay ventas aún</div>
        </div>
      </div>
    </div>
  )
}
