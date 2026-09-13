# Features and functionality

What the system does, by the person using it. Every item here is implemented in the
production application; nothing is aspirational.

---

## Roles

One deployment, six role types. The role decides which screens exist, and the API
enforces it independently of the interface.

| Role | What they do |
|---|---|
| **Captain / waiter** | Claims tables, takes orders, sends tickets to the kitchen |
| **Cashier** | Everything above, plus billing, payments, refunds and closing the day |
| **Branch manager** | Menu, staff and settings for their own outlet |
| **Admin** | Reporting, GST profiles and bill administration |
| **Super admin / owner** | Consolidated view across all outlets |

---

## Taking an order

- **Table-first or parcel.** Dine-in orders attach to a table; parcel orders skip
  the floor entirely and go straight to a ticket.
- **Search-driven menu** with keyboard shortcuts built for speed at a till —
  `/` focuses search, `F8` confirms the order, `F9` moves to billing. A cashier
  working a queue never has to reach for the mouse.
- **Live cart** with per-item quantity, running totals, and the GST slab shown on
  every item as it is added.
- **Guest name and cover count** captured optionally, for tables that want the bill
  under a name.
- **Kitchen ticket numbering is automatic** and assigned by the server, so two
  devices ordering at once cannot produce the same ticket number or skip one.
- **A twelve-minute timer** is stamped on each order at creation, giving the floor
  a consistent measure of how long a table has been waiting.

## The floor

- **Live table board**, grouped by section, colour-coded by state:
  available, occupied, or bill requested.
- **Every device sees the same state instantly.** A table claimed on a tablet in
  one corner updates the cashier's screen without a refresh.
- **Two captains cannot claim the same table.** The second attempt is rejected by
  the database with a specific error, and that captain is told to refresh rather
  than silently building a second order on an occupied table.
- **Tables are held** by whoever claimed them, so an order in progress is
  attributable.

## Billing

- **GST computed per line, not on the total** — CGST and SGST split from the slab
  that item carried at the moment it was ordered, so a reprinted bill always
  reproduces the original.
- **Discounts** by percentage or flat amount.
- **Other charges** added as named line items.
- **Payment methods**: UPI, card, net banking, cash.
- **Notes printed on the receipt** for anything the guest asked for.
- **Bills are sequentially numbered** per outlet, per day.
- **A finalised bill is locked.** Its payment method cannot be changed afterwards,
  and no further items can be added to the order behind it. Both rules live in the
  database, so they hold no matter which screen or device is used.
- **Voids and refunds** are recorded with a reason and flagged for review rather
  than deleted, so the day's figures still reconcile.

## Printing

- **Thermal receipts and kitchen tickets** over ESC/POS, on either LAN or USB
  printers.
- **Printing is a queue, not a blocking call.** A jammed or offline printer does
  not stop a cashier from closing a bill — the job waits and retries.
- **Reprint any past bill** from the transactions list.

## Menu management

- **Categories and items** with price, GST slab, and availability.
- **Availability toggles instantly** — an item that runs out mid-service disappears
  from every captain's screen at once.
- **Drag to reorder**, so the layout matches how the kitchen thinks about the menu.

## Staff management

- **Add and edit staff** with role, contact details and a PIN for quick till login.
- **Deactivate rather than delete**, so past orders keep their attribution.

## Reporting

- **Daily, monthly and yearly views** of revenue, order count, average bill, and
  voids/refunds.
- **Payment method breakdown** — how much came in by UPI versus cash versus card.
- **Top items sold**, to see what is actually carrying the menu.
- **Day-by-day breakdown** within any month.
- **PDF export** carrying the outlet's registered GSTIN, plus CSV and Excel export
  for anything that needs to go to an accountant.

## GST

- **Multiple GSTIN profiles per outlet**, each with legal name and address, one
  marked default.
- **The chosen profile prints on the invoice**, so a bill is a valid tax document
  as issued rather than something reconstructed later.

## Owner view

- **All outlets on one screen**, with revenue, orders and average bill per site.
- **Filter by day, week or month**, and compare outlets directly.
- **CSV export** of the consolidated figures.
- **Degrades rather than fails.** If one outlet is unreachable, the others still
  report; the view shows what it could reach.

## End of day

- **Close the day** from the till, with a warning if orders are still open and an
  explicit override for the cashier who knows why.
- **An automatic 23:00 reminder** to any outlet that has left the day open.

## Notifications

- **Web push to staff devices** for events that need attention, so a captain does
  not have to keep the app in the foreground to know a bill was requested.

## Working offline

Each outlet runs its own database on site. If the internet connection drops, that
restaurant keeps taking orders, printing tickets and closing bills exactly as
normal. Only the owner's cross-outlet view has to wait for the line to return.
