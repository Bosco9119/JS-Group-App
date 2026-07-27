export type DriverUser = {
  id: number;
  name: string;
  email: string;
};

export type DriverProfile = {
  id: number;
  name: string;
  ic_number: string | null;
  phone: string | null;
  status: string;
  status_label: string;
  photo_url: string | null;
};

export type VehicleSummary = {
  id: number;
  vehicle_code: string;
  car_plate: string;
  brand: string | null;
  model: string | null;
};

export type JobLineItem = {
  sku?: string | null;
  name: string;
  qty: number | string;
  uom?: string | null;
  packaging?: string | null;
  condition?: string | null;
  description?: string | null;
  quantity_expected?: number | string | null;
  quantity_good?: number | string | null;
  quantity_repair?: number | string | null;
  quantity_damage?: number | string | null;
  quantity_scrap?: number | string | null;
};

export type JobSummary = {
  id: number;
  job_no: string;
  job_type: string;
  job_type_label: string;
  status: string;
  status_label: string;
  customer_name: string | null;
  address_text: string | null;
  contact_person: string | null;
  contact_no: string | null;
  items_description: string | null;
  special_instructions: string | null;
  started_at: string | null;
  completed_at: string | null;
  /** Optional richer fields — render when API provides them. */
  delivery_order_nos?: string[] | null;
  line_items?: JobLineItem[] | null;
  latitude?: number | null;
  longitude?: number | null;
  document_no?: string | null;
  document_status?: string | null;
  has_source_document_pdf?: boolean | null;
  source_type?: string | null;
  source_id?: number | null;
};

export type TripStopSummary = {
  id: number;
  sequence: number;
  stop_type: string;
  stop_type_label: string;
  status: string;
  status_label: string;
  planned_arrival: string | null;
  actual_arrival: string | null;
  completed_at: string | null;
  job: JobSummary | null;
};

export type ChecklistItem = {
  key: string;
  label: string;
  passed: boolean | null;
  notes: string | null;
};

export type VehicleChecklist = {
  passed: boolean | null;
  checked_at: string | null;
  checked_by_driver_id: number | null;
  items: ChecklistItem[];
  photo_urls: string[];
};

export type ChecklistItemInput = {
  key: string;
  label: string;
  passed: boolean;
  notes?: string | null;
};

export type DriverTripSummary = {
  id: number;
  trip_no: string;
  status: string;
  status_label: string;
  planned_date: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  is_overnight: boolean;
  is_out_state: boolean;
  notes: string | null;
  vehicle: VehicleSummary | null;
  stops_count: number;
  stops_completed_count: number;
  can_clock_in: boolean;
  all_stops_done: boolean;
  can_clock_out: boolean;
  checklist?: VehicleChecklist | null;
  stops?: TripStopSummary[];
};

export type ProofPhoto = {
  id: number;
  transport_job_id: number;
  driver_trip_id: number | null;
  trip_stop_id: number | null;
  photo_type: string;
  photo_type_label: string;
  photo_path: string;
  photo_url: string | null;
  caption: string | null;
  sort_order: number;
  taken_at: string | null;
  source: string;
  client_uuid: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type LoginResponse = {
  token: string;
  token_type: string;
  user: DriverUser;
  driver: DriverProfile;
};

export type MeResponse = {
  user: DriverUser;
  driver: DriverProfile;
};

export type ApiFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  errors: ApiFieldErrors;
  body: unknown;

  constructor(message: string, status: number, errors: ApiFieldErrors = {}, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
}

export type LocalImage = {
  uri: string;
  name: string;
  mimeType: string;
};
