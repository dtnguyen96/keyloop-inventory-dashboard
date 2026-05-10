/**
 * Shared domain types and interfaces for the inventory dashboard.
 * All domain types should be imported from this module.
 */

export enum ActionType {
  PRICE_REDUCTION = 'PRICE_REDUCTION',
  PROMOTION = 'PROMOTION',
  TRANSFER = 'TRANSFER',
  AUCTION = 'AUCTION',
  OTHER = 'OTHER',
}

export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  price: number;
  addedAt: string; // ISO 8601 UTC timestamp
  createdAt: string;
  daysInInventory: number;
  isAging: boolean;
}

export interface VehicleAction {
  id: string;
  vehicleId: string;
  actionType: ActionType;
  notes: string | null;
  createdAt: string;
}

export interface VehicleWithActions extends Vehicle {
  actions: VehicleAction[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AgingSummary {
  totalAging: number;
  oldestAgeDays: number;
  averageAgeDays: number;
}
