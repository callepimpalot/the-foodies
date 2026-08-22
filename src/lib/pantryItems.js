// TASK 11 Phase 1 — the pantry item state transitions, as pure functions.
//
// Extracted out of InventoryContext so they can be asserted from a plain node script.
// The reason is specific: `flagged` is what puts an item on the shopping list, that
// path already works, and TASK_11 says in two separate places not to regress it or
// build a parallel route to the list. Reasoning about that inside a React context is
// how it quietly breaks; here it is checked.
//
// The item shape is { id, name, emoji, category, flagged, lowStock?, useByDate? }.
// The two new fields are OPTIONAL — an item stored before this shipped has neither,
// and that is valid. Nothing here ever introduces a field that wasn't asked for.

/**
 * Toggle the shopping-list flag. This is what ShopView calls when you tick an item
 * off in the supermarket, and its list behaviour is unchanged.
 *
 * The one addition: un-flagging clears `lowStock`. However it happened — ticked off
 * in Shop, or tapped again in Pantry — it means "I have it now", and a pantry that
 * still claims you're low on something you just bought is worse than no pantry.
 */
export function withFlagToggled(item) {
    const flagged = !item?.flagged;
    return { ...item, flagged, lowStock: flagged ? (item?.lowStock ?? false) : false };
}

/**
 * The Pantry grid's one tap: "I'm running low on this."
 *
 * Records the pantry state AND puts it on the list through the EXISTING `flagged`
 * mechanism — deliberately not a second route to the shopping list. The net effect on
 * Shop is identical to what the old flag-only tap did, which is the point.
 */
export function withLowStockToggled(item) {
    const lowStock = !item?.lowStock;
    return { ...item, lowStock, flagged: lowStock };
}

/** Set or clear the use-by date. ISO 'YYYY-MM-DD', or anything falsy to clear. */
export function withUseByDate(item, isoDate) {
    return { ...item, useByDate: isoDate || null };
}

/** Reset both the list flag and the low-stock state. */
export function withFlagsCleared(item) {
    return { ...item, flagged: false, lowStock: false };
}

/** What ShopContext puts on the list: anything currently flagged. */
export function isOnShoppingList(item) {
    return !!item?.flagged;
}
