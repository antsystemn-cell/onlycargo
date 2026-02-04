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
  shipment_id: string | null;
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
  weight_rate: number;
  volume_rate: number;
  china_address_prefix: string;
  china_address_text: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  code: string;
  price: number;
  description: string | null;
  polygon: any;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrder {
  id: string;
  user_id: string;
  payment_id: string | null;
  delivery_type: 'self_pickup' | 'delivery';
  delivery_zone_id: string | null;
  delivery_address_id: string | null;
  map_coordinates: { lat: number; lng: number } | null;
  delivery_price: number;
  cargo_price: number;
  total_price: number;
  status: 'pending' | 'paid' | 'processing' | 'delivering' | 'completed' | 'cancelled';
  pickup_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  shipment_number: string;
  loaded_by: string;
  loaded_at: string;
  cargo_count: number;
  total_weight: number | null;
  notes: string | null;
  status: 'loaded' | 'in_transit' | 'arrived' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'topup' | 'payment' | 'refund' | 'referral_reward' | 'admin_adjustment';
  amount: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  uses_count: number;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code_id: string;
  reward_amount: number | null;
  reward_paid: boolean;
  reward_paid_at: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
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

// Alias for backward compatibility
export const CARGO_STATUS_LABELS = STATUS_LABELS;

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
