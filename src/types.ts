export type Shift = 'fulltime' | 'halfmorning' | 'halfafternoon' | 'online';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
export type WorkSchedule = Record<Weekday, Shift | null>;

export interface SavedSchedule {
  mentorEmail: string;
  weekStartDate: string;
  monday: Shift | null;
  tuesday: Shift | null;
  wednesday: Shift | null;
  thursday: Shift | null;
  friday: Shift | null;
}

export interface ScheduleLookup {
  found: boolean;
  schedule: SavedSchedule | null;
}

export interface User {
  id: string;
  fullname: string;
  email: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface Leader {
  email: string;
  fullname: string;
}

export interface CheckStatus {
  checkin: boolean;
  checkout: boolean;
  recordedAt?: string | null;
  checkinAt?: string | null;
  checkoutAt?: string | null;
}

export interface LocationCheck {
  latitude: number;
  longitude: number;
  distanceMeters: number;
  maximumDistanceMeters: number;
  withinOfficeRadius: boolean;
  withinCheckInWindow: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  isSuccess: boolean;
  errorMessage: string | null;
  errorCode?: string | null;
}
