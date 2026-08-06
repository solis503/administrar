import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Para cada receta, calcula cuántas unidades se pueden armar ahorita mismo
 * según el ingrediente que menos alcance (ej: si una torta lleva 1 pan y 0.1kg
 * de aguacate, y hay 5 panes pero solo 0.3kg de aguacate, alcanza para 3 tortas).
 * No modifica nada en la base de datos, es solo un cálculo para mostrar/limitar.
 */
export async function getRecipeAvailability(
  supabase: SupabaseClient,
  recipeProductIds: string[]
): Promise<Record<string, number>> {
  const availability: Record<string, number> = {}
  if (recipeProductIds.length === 0) return availability

  const { data: items } = await supabase
    .from('recipe_items')
    .select('product_id, quantity, ingredient:products!ingredient_id(id, stock, product_type)')
    .in('product_id', recipeProductIds)

  const byRecipe: Record<string, { qty: number; ingredientStock: number }[]> = {}
  for (const item of items || []) {
    const ingredient = (item as any).ingredient
    if (!ingredient) continue
    if (!byRecipe[item.product_id]) byRecipe[item.product_id] = []
    byRecipe[item.product_id].push({ qty: Number(item.quantity), ingredientStock: Number(ingredient.stock) })
  }

  for (const recipeId of recipeProductIds) {
    const ingredients = byRecipe[recipeId]
    if (!ingredients || ingredients.length === 0) { availability[recipeId] = 0; continue }
    const possible = ingredients.map(i => i.qty > 0 ? Math.floor(i.ingredientStock / i.qty) : 0)
    availability[recipeId] = Math.max(0, Math.min(...possible))
  }

  return availability
}
