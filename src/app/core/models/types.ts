export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  locationUrl: string;
}

export interface Product {
  id: string;
  name: string;
  basePrice: number;
  stock: number;
  unit: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  avatar: string; // Initials (e.g. "CM")
  usuario_id?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // Applied price (may differ from basePrice)
}

export type OrderStatus = 'pending' | 'loaded' | 'route' | 'delivered' | 'failed';

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  vendorId: string | null;
  vendorName: string | null;
  status: OrderStatus;
  createdAt: string; // ISO string or timestamp
  deliveredAt: string | null;
  items: OrderItem[];
  total: number;
  failedReason?: string; // Reason why delivery failed
}

export interface KPIs {
  pending: number;
  inRoute: number;
  delivered: number;
  totalRevenue: number;
}
