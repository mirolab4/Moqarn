export interface UserProfile {
  id: string;
  email: string;
  pharmacyName: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  trialEndsAt: string;
  subscribedUntil: string | null;
  role: 'admin' | 'user';
}

export interface Supplier {
  id: string;
  userId: string;
  name: string;
  phone: string;
  minOrder?: number;
  columnMapping?: string; // serialized JSON
  lastUploadAt?: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Drug {
  id: string;
  userId: string;
  supplierId: string;
  supplierName: string;
  name: string;
  normalizedName: string;
  price: number;
  discount: number;
  bonusBuy: number;
  bonusFree: number;
  bonusText: string;
  effectivePrice: number;
  expiry?: string;
  uncertain?: boolean;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  userId: string;
  drugId: string;
  drugName: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierMinOrder?: number;
  quantity: number;
  price: number;
  effectivePrice: number;
  bonusText?: string;
  discount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExcelColumnMapping {
  drugNameCol: string;
  priceCol: string;
  bonusCol?: string;
  discountCol?: string;
  expiryCol?: string;
}

export interface ReviewDrugItem {
  id?: string;
  name: string;
  price: number;
  discount: number;
  bonusBuy: number;
  bonusFree: number;
  bonusText: string;
  effectivePrice: number;
  expiry?: string;
  uncertain?: boolean;
}
