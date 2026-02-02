export type CargoStatus = 
  | 'registered' 
  | 'received_ereen' 
  | 'transporting' 
  | 'warehouse_processing' 
  | 'ready_warehouse' 
  | 'completed';

export type AppRole = 'admin' | 'user' | 'china_warehouse' | 'branch_admin';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type PaymentMethod = 'qpay' | 'cash' | 'bank_transfer' | 'manual';

export interface Cargo {
  id: string;
  track_number: string;
  phone_number: string;
  user_id: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  status: CargoStatus;
  status_date: string;
  price: number | null;
  shelf_location: string | null;
  notes: string | null;
  branch_id: string | null;
  cubic_meter_price: number | null;
  kg_price: number | null;
  total_cubic_meters: number | null;
  registered_by: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

// Public cargo data from cargo_public view (limited fields for non-authenticated users)
export interface CargoPublic {
  id: string | null;
  track_number: string | null;
  status: CargoStatus | null;
  status_date: string | null;
  created_at: string | null;
}

export interface Profile {
  id: string;
  phone: string;
  full_name: string | null;
  default_branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  address_line: string;
  city: string;
  district: string | null;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  is_global: boolean;
  user_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CargoPreregistration {
  id: string;
  user_id: string;
  track_number: string;
  description: string | null;
  matched_cargo_id: string | null;
  created_at: string;
}

export interface CargoPhoto {
  id: string;
  cargo_id: string;
  photo_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface CargoStatusHistory {
  id: string;
  cargo_id: string;
  status: CargoStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  branch_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  qpay_invoice_id: string | null;
  qpay_qr_text: string | null;
  qpay_qr_image: string | null;
  qpay_urls: Record<string, string> | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCargo {
  id: string;
  payment_id: string;
  cargo_id: string;
  created_at: string;
}

export interface SiteSetting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export const STATUS_LABELS: Record<CargoStatus, string> = {
  registered: 'Бүртгэгдсэн',
  received_ereen: 'Эрээнд хүлээн авсан',
  transporting: 'Тээвэрлэгдэж байна',
  warehouse_processing: 'Агуулахад боловсруулж байна',
  ready_warehouse: 'Агуулахад бэлэн',
  completed: 'Хүлээлгэж өгсөн',
};

export const STATUS_COLORS: Record<CargoStatus, string> = {
  registered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  received_ereen: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  transporting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  warehouse_processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  ready_warehouse: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-muted text-muted-foreground',
};

export const STATUS_ORDER: CargoStatus[] = [
  'registered',
  'received_ereen',
  'transporting',
  'warehouse_processing',
  'ready_warehouse',
  'completed',
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Хүлээгдэж байна',
  paid: 'Төлөгдсөн',
  failed: 'Амжилтгүй',
  cancelled: 'Цуцлагдсан',
  refunded: 'Буцаагдсан',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  refunded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};
