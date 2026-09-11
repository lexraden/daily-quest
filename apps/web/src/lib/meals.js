/**
 * How a meal is named when changing it.
 *
 * The server assigns an id on append. Meals written before ids existed have
 * none, so the timestamp stands in — it is what the server falls back to as
 * well, and it keeps those rows editable instead of stranding them behind a
 * migration.
 */
export function mealKey(meal) {
  return meal?.id || meal?.timestamp || '';
}
