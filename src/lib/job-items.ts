import type { JobLineItem, JobSummary } from '@/lib/types';

/** Whole numbers without .0 — drivers want “10 pcs”, not “10.0 pcs”. */
export function formatItemQty(qty: number | string | null | undefined): string {
  if (qty === null || qty === undefined || qty === '') return '—';
  const n = typeof qty === 'number' ? qty : Number(String(qty).trim());
  if (!Number.isFinite(n)) return String(qty);
  return Number.isInteger(n) ? String(n) : String(n);
}

export function formatItemQtyLabel(
  item: Pick<JobLineItem, 'qty' | 'uom' | 'quantity_expected'>,
): string {
  const raw = item.quantity_expected ?? item.qty;
  const qty = formatItemQty(raw);
  const uom = item.uom?.trim();
  return uom ? `${qty} ${uom}` : qty;
}

export function isRentalReturnJob(job?: JobSummary | null): boolean {
  return job?.source_type === 'rental_return_in' || job?.job_type === 'rental_return';
}

export function isDeliveryOrderJob(job?: JobSummary | null): boolean {
  return job?.source_type === 'delivery_order' || job?.job_type === 'delivery';
}

/** Prefer structured line items (with qty); API may send empty array. */
export function jobLineItems(job?: JobSummary | null): JobLineItem[] {
  if (!job?.line_items?.length) return [];
  return job.line_items.filter((item) => item?.name?.trim());
}

/** Secondary DO nos when primary document_no already shown (e.g. RRI linked DO). */
export function secondaryDeliveryOrderNos(job?: JobSummary | null): string[] {
  const nos = (job?.delivery_order_nos ?? []).filter(Boolean);
  if (!nos.length) return [];
  const primary = job?.document_no?.trim();
  if (!primary) return nos;
  return nos.filter((no) => no !== primary);
}
