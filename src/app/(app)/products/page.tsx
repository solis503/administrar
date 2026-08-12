import { redirect } from 'next/navigation'

// Productos e Inventario se unificaron en una sola pantalla para no duplicar funciones.
// Cualquier enlace viejo a /products manda directo a /inventory.
export default function ProductsRedirect() {
  redirect('/inventory')
}
