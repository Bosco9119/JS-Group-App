import type { JobLineItem, JobSummary } from '@/lib/types';

/** Strip accidental HTML from ERP/seed text (e.g. packaging `<p>yes</p>`). */
export function stripHtmlText(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

/**
 * Display helpers for a line item.
 * API: `sku` from product.sku_code; `name` from product.name (falls back to DO/RRI item code).
 * Strip HTML that sometimes leaks into packaging/description seed data.
 */
export function lineItemDisplay(item: JobLineItem): {
  sku: string | null;
  name: string;
  description: string | null;
  packaging: string | null;
  condition: string | null;
} {
  const sku = item.sku?.trim() || null;
  const name = item.name?.trim() || sku || '—';
  const description = stripHtmlText(item.description) || null;
  const packaging = stripHtmlText(item.packaging) || null;
  const condition = stripHtmlText(item.condition) || null;

  const same = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

  return {
    // Hide gray SKU row when name is just the same code (no linked product).
    sku: sku && !same(name, sku) ? sku : null,
    name,
    description: description && !same(description, name) ? description : null,
    packaging,
    condition,
  };
}

export function isRentalReturnJob(job?: JobSummary | null): boolean {
  const type = job?.job_type?.trim().toLowerCase();
  return (
    job?.source_type === 'rental_return_in' ||
    type === 'rental_return' ||
    type === 'rental_return_in'
  );
}

export function isDeliveryOrderJob(job?: JobSummary | null): boolean {
  return job?.source_type === 'delivery_order' || job?.job_type === 'delivery';
}

/**
 * Show View document when the job has (or should have) a printable DO/RRI.
 * Production may omit `has_source_document_pdf` but still send `delivery_order_nos`.
 */
export function jobHasSourceDocumentPdf(job?: JobSummary | null): boolean {
  if (!job) return false;
  if (job.has_source_document_pdf === true) return true;
  if (job.document_no?.trim()) return true;
  if ((job.delivery_order_nos ?? []).some((no) => !!no?.trim())) return true;
  if (job.source_type === 'delivery_order' || job.source_type === 'rental_return_in') return true;
  if (job.has_source_document_pdf === false) return false;
  return isDeliveryOrderJob(job) || isRentalReturnJob(job);
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
