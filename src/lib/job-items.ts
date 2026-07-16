import type { JobLineItem, JobSummary } from '@/lib/types';

/** Whole numbers without .0 — drivers want “10 pcs”, not “10.0 pcs”. */
export function formatItemQty(qty: number | string | null | undefined): string {
  if (qty === null || qty === undefined || qty === '') return '—';
  const n = typeof qty === 'number' ? qty : Number(String(qty).trim());
  if (!Number.isFinite(n)) return String(qty);
  return Number.isInteger(n) ? String(n) : String(n);
}

export function formatItemQtyLabel(item: Pick<JobLineItem, 'qty' | 'uom'>): string {
  const qty = formatItemQty(item.qty);
  const uom = item.uom?.trim();
  return uom ? `${qty} ${uom}` : qty;
}

/** Prefer structured line items (with qty); API may send empty array. */
export function jobLineItems(job?: JobSummary | null): JobLineItem[] {
  if (!job?.line_items?.length) return [];
  return job.line_items.filter((item) => item?.name?.trim());
}
