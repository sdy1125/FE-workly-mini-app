import type { ApiResponse, CheckStatus, Leader, LocationCheck, SavedSchedule, ScheduleLookup, Session, WorkSchedule } from './types';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const baseUrl = configuredBaseUrl
  ? (configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`)
  : null;

export class ApiError extends Error {
  constructor(message: string, readonly code: string | null = null, readonly status = 0) {
    super(message);
  }
}

function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => window.clearTimeout(timeoutId));
}

async function checkBackendHealth(): Promise<void> {
  if (!baseUrl) throw new Error('Chưa cấu hình API Workly HTTPS cho Mini App.');
  const healthUrl = new URL('/healthz', baseUrl);
  try {
    const response = await fetchWithTimeout(healthUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' }, 12000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json() as { status?: string };
    if (result.status !== 'ok') throw new Error('Phản hồi /healthz không hợp lệ.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Zalo (${window.location.origin}) không truy cập được ${healthUrl.origin}/healthz (${detail}). Kiểm tra CORS của đúng Origin này, TLS và kết nối mạng điện thoại.`);
  }
}

async function request<T>(path: string, token?: string, body?: unknown): Promise<T> {
  if (!baseUrl) throw new Error('Chưa cấu hình API Workly HTTPS cho Mini App.');
  const url = new URL(path, baseUrl);
  const response = await fetchWithTimeout(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Zalo (${window.location.origin}) không tải được ${url.pathname} từ ${url.origin} (${detail}). Kiểm tra CORS cho đúng Origin, TLS và kết nối mạng điện thoại.`);
  });
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!result) throw new Error(`API không trả dữ liệu JSON (${response.status})`);
  if (!response.ok || !result.isSuccess || result.data == null) {
    throw new ApiError(result.errorMessage || `API lỗi (${response.status})`, result.errorCode || null, response.status);
  }
  return result.data;
}

export const api = {
  configured: !!baseUrl,
  checkBackendHealth,
  leaders: (token: string) => request<Leader[]>('mini-app/mentors', token),
  testSession: () => request<Session>('mini-app/test-session', undefined, {}),
  status: (token: string) => request<CheckStatus>('mini-app/status', token),
  checkLocation: (token: string, locationToken: string, zaloAccessToken: string) =>
    request<LocationCheck>('mini-app/location-check', token, { locationToken, zaloAccessToken }),
  savedSchedule: (token: string, weekStartDate: string) =>
    request<ScheduleLookup>(`mini-app/schedule?weekStartDate=${encodeURIComponent(weekStartDate)}`, token),
  saveSchedule: (token: string, mentorEmail: string, weekStartDate: string, workSchedule: WorkSchedule) =>
    request<SavedSchedule>('mini-app/schedule', token, { mentorEmail, weekStartDate, workSchedule }),

  // Server xác thực Zalo trước khi tạo phiên Workly.
  zaloSession: (zaloAccessToken: string) =>
    request<Session>('mini-app/session', undefined, { zaloAccessToken }),

  // Server giải mã Zalo location token và kiểm tra 50 m, 09:00-10:00 cho check-in.
  checkIn: (token: string, locationToken: string, zaloAccessToken: string) =>
    request<CheckStatus>('mini-app/check-in', token, { locationToken, zaloAccessToken }),
  checkOut: (token: string, locationToken: string, zaloAccessToken: string) =>
    request<CheckStatus>('mini-app/check-out', token, { locationToken, zaloAccessToken }),
};
