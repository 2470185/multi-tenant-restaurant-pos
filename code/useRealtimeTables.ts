/**
 * Realtime table-state subscription hook (React + PocketBase SSE).
 *
 * Extracted verbatim from a production restaurant POS. The floor view shows
 * every table's live status — free, seated, order open, bill requested — and
 * multiple staff act on the same tables at once from different devices, so
 * the view has to converge without anyone pressing refresh.
 *
 * `getCurrentBranchPB()` resolves the PocketBase client for the active outlet;
 * that indirection is what makes one build serve several outlets. It is not
 * included here as it is coupled to the app's tenant resolution.
 *
 * ---------------------------------------------------------------------------
 * Why each unsubscribe is tracked individually
 *
 * PocketBase's `unsubscribe('*')` removes *every* listener on that collection
 * for the whole client, not just the ones this hook registered. An early
 * version called it in cleanup. Unmounting the floor view then silently killed
 * the subscriptions held by the global store and by any open order or bill
 * screen — those views stayed mounted, stopped receiving events, and quietly
 * served stale data. Nothing threw; the screen was simply wrong.
 *
 * Tracking each subscription's own disposer keeps cleanup scoped to this hook.
 *
 * The `cancelled` flag handles the converse race: `subscribe()` is async, so a
 * fast unmount can resolve after cleanup has already run. Without the flag
 * that subscription is never disposed and leaks for the session.
 * ---------------------------------------------------------------------------
 *
 * Known limitations, stated honestly:
 *
 *  - `any[]` for table records. These are PocketBase records with runtime
 *    `expand` relations; typing them properly needs generated collection types,
 *    which this project never set up.
 *  - Any `orders` event triggers a full table refetch. Correct, but chattier
 *    than it needs to be — a busy dinner service refetches far more than the
 *    one changed row. Reconciling the order event into local state would fix it.
 *  - `branchId` is interpolated into the filter string. It comes from internal
 *    tenant resolution rather than user input, but it is still unparameterised,
 *    and I would bind it rather than interpolate it if writing this again.
 *  - The `getOne` refetch swallows its error. A failed refetch should at least
 *    be surfaced rather than leaving the row silently un-updated.
 */

import { useEffect, useState } from 'react';
import { getCurrentBranchPB } from '@/lib/bubble/pb';

export function useRealtimeTables(branchId: string) {
  const [tables, setTables] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !branchId) return;

    const pb = getCurrentBranchPB();

    const fetchTables = () => {
      pb.collection('tables')
        .getFullList({
          filter: `branch_id = "${branchId}"`,
          sort: 'label',
          expand: 'locked_by,current_order_id.captain_id',
          $autoCancel: false,
        })
        .then(setTables)
        .catch(console.error);
    };

    fetchTables();

    // Refetch on focus to recover events missed while backgrounded. Mobile
    // browsers suspend SSE connections aggressively when a tab loses focus,
    // and staff switch apps constantly mid-service.
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchTables();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);

    const handleTableEvent = async (e: any) => {
      // SSE payloads do not carry `expand`, so the record arrives without its
      // relations. Refetch the row to get them, or the UI loses the captain
      // name and lock holder on every update.
      let record = e.record;
      if (e.action === 'update' || e.action === 'create') {
        try {
          record = await pb.collection('tables').getOne(e.record.id, {
            expand: 'locked_by,current_order_id.captain_id',
            $autoCancel: false,
          });
        } catch (err) {
          /* see limitations above */
        }
      }
      setTables((prev) => {
        if (e.action === 'update') {
          return prev.map((t) => (t.id === record.id ? record : t));
        }
        if (e.action === 'create') return [...prev, record];
        if (e.action === 'delete') return prev.filter((t) => t.id !== record.id);
        return prev;
      });
    };

    // Track each subscription's own removal function — see header.
    const unsubs: Array<() => void> = [];
    let cancelled = false;
    const track = (p: Promise<() => void>) =>
      p
        .then((u) => {
          if (cancelled) u();
          else unsubs.push(u);
        })
        .catch(console.error);

    track(pb.collection('tables').subscribe('*', handleTableEvent));

    // Order changes alter the totals shown on each table card.
    const handleOrderEvent = () => {
      fetchTables();
    };
    track(pb.collection('orders').subscribe('*', handleOrderEvent));

    return () => {
      cancelled = true;
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          /* disposer already invalidated by a dropped connection */
        }
      });
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
    };
  }, [branchId]);

  return tables;
}
