/**
 * GST bill calculation — Indian CGST/SGST intra-state split.
 *
 * Extracted verbatim from a production restaurant POS (running across three
 * outlets). Included here as a work sample; the surrounding application is
 * private client property.
 *
 * The design decision worth noting is the *_snapshot fields. A bill is
 * computed from the price and GST slab captured on the order line at the
 * moment the item was ordered — never from the live menu record. Menu prices
 * and slabs change; a bill printed in April must still reproduce exactly if
 * it is reprinted in October, and GST filings are audited against the figures
 * as issued. Reading the current menu row would silently rewrite history.
 *
 * Scope: intra-state supply only, which is what a single-state restaurant
 * issues. Inter-state supply uses IGST at the full slab rate instead of an
 * equal CGST/SGST split — that path is deliberately not modelled here because
 * the business never needed it, and a half-implemented IGST branch would be
 * worse than none.
 */

/** GST rate slabs applicable to restaurant supply. */
export type GstSlab = 0 | 5 | 12 | 18 | 28;

export interface OrderLineForBilling {
  name: string;
  /** Unit price captured when the item was ordered, not the live menu price. */
  price_snapshot: number;
  /** GST slab captured when the item was ordered, not the live menu slab. */
  gst_slab_snapshot: GstSlab;
  quantity: number;
}

export interface BillLineItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total_before_gst: number;
  /** Half the slab — a 12% slab yields 6% CGST + 6% SGST. */
  cgst_rate: number;
  sgst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  line_total_with_gst: number;
}

export interface BillSummary {
  line_items: BillLineItem[];
  subtotal: number;
  cgst_total: number;
  sgst_total: number;
  grand_total: number;
}

/**
 * Builds a complete bill from order lines.
 *
 * Rounding is applied per line rather than once at the end. Two lines of
 * 33.333 rounded at the end give 66.67; rounded per line they give 66.66.
 * The printed receipt shows per-line amounts, so the totals must be the sum
 * of the numbers the customer can actually see — otherwise the receipt fails
 * to add up under inspection.
 *
 * Zero-quantity lines are dropped rather than rendered at 0.00, which keeps
 * removed items off the printed bill.
 */
export function calculateBill(lines: OrderLineForBilling[]): BillSummary {
  const line_items: BillLineItem[] = lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const line_total_before_gst = parseFloat(
        (l.price_snapshot * l.quantity).toFixed(2),
      );

      // Intra-state supply splits the slab equally between CGST and SGST.
      const gst_rate = l.gst_slab_snapshot / 2;

      const cgst_amount = parseFloat(
        ((line_total_before_gst * gst_rate) / 100).toFixed(2),
      );
      // Equal by definition for intra-state supply — derived, not recomputed,
      // so the two halves can never drift apart through separate rounding.
      const sgst_amount = cgst_amount;

      return {
        name: l.name,
        quantity: l.quantity,
        unit_price: l.price_snapshot,
        line_total_before_gst,
        cgst_rate: gst_rate,
        sgst_rate: gst_rate,
        cgst_amount,
        sgst_amount,
        line_total_with_gst: parseFloat(
          (line_total_before_gst + cgst_amount + sgst_amount).toFixed(2),
        ),
      };
    });

  const subtotal = parseFloat(
    line_items.reduce((s, l) => s + l.line_total_before_gst, 0).toFixed(2),
  );
  const cgst_total = parseFloat(
    line_items.reduce((s, l) => s + l.cgst_amount, 0).toFixed(2),
  );
  const sgst_total = parseFloat(
    line_items.reduce((s, l) => s + l.sgst_amount, 0).toFixed(2),
  );
  const grand_total = parseFloat(
    (subtotal + cgst_total + sgst_total).toFixed(2),
  );

  return { line_items, subtotal, cgst_total, sgst_total, grand_total };
}
