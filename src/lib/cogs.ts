import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Devuelve un mapa product_id -> costo unitario real.
 * Para productos simples usa el campo `cost`.
 * Para recetas, suma (cantidad de cada ingrediente x costo de ese ingrediente).
 */
export async function getProductCostMap(
  supabase: SupabaseClient,
  businessId: string
): Promise<Record<string, number>> {
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, cost, product_type')
    .eq('business_id', businessId)

  const costMap: Record<string, number> = {}
  const recipeIds: string[] = []

  for (const p of allProducts || []) {
    if (p.product_type === 'receta') {
      recipeIds.push(p.id)
      costMap[p.id] = 0
    } else {
      costMap[p.id] = Number(p.cost) || 0
    }
  }

  if (recipeIds.length > 0) {
    const { data: items } = await supabase
      .from('recipe_items')
      .select('product_id, quantity, ingredient:products!ingredient_id(cost)')
      .in('product_id', recipeIds)

    for (const item of items || []) {
      const ingredientCost = Number((item as any).ingredient?.cost) || 0
      costMap[item.product_id] = (costMap[item.product_id] || 0) + Number(item.quantity) * ingredientCost
    }
  }

  return costMap
}

/** Suma el costo total (costo de mercancía vendida) de una lista de líneas de venta */
export function calculateCOGS(
  saleItems: { product_id: string | null; quantity: number; cost?: number }[],
  costMap: Record<string, number>
): number {
  return saleItems.reduce((sum, item) => {
    const unitCost = item.product_id ? (costMap[item.product_id] || 0) : (Number(item.cost) || 0)
    return sum + Number(item.quantity) * unitCost
  }, 0)
}
