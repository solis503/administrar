export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-4">FlowStock Pro</h1>
        <p className="text-center text-gray-600 mb-6">Sistema de Inventario y Punto de Venta</p>
        <div className="text-center">
          <p className="text-green-600 font-semibold">✓ ¡Funciona!</p>
          <p className="text-sm text-gray-500 mt-2">Tu app está en línea</p>
        </div>
      </div>
    </div>
  )
}
