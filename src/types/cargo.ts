export type CargoStatus = 'registered' | 'in_transit' | 'arrived_ub' | 'completed';

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

export const STATUS_LABELS: Record<CargoStatus, string> = {
  registered: 'Бүртгэгдсэн',
  in_transit: 'Тээвэрлэгдэж байна',
  arrived_ub: 'УБ-д ирсэн',
  completed: 'Хүлээлгэж өгсөн',
};

export const STATUS_COLORS: Record<CargoStatus, string> = {
  registered: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-yellow-100 text-yellow-800',
  arrived_ub: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};
