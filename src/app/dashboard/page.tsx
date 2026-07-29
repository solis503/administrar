export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">📊 Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Ventas de Hoy</p>
            <p className="text-3xl font-bold text-blue-600">$0.00</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Productos</p>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Alertas</p>
            <p className="text-3xl font-bold text-amber-600">0</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-gray-500">¡Dashboard listo! Pronto agregaremos todas las funciones.</p>
        </div>
      </div>
    </div>
  )
}
