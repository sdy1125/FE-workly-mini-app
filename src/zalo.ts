import { getAccessToken, getLocation, login } from 'zmp-sdk';

function zaloErrorDetail(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const value = error as { code?: unknown; message?: unknown; api?: unknown };
    const parts = [
      typeof value.code === 'number' ? `mã ${value.code}` : null,
      typeof value.message === 'string' ? value.message : null,
      typeof value.api === 'string' ? `API ${value.api}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function withTimeout<T>(promise: Promise<T>, action: string): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${action} quá 20 giây. Hãy đóng rồi mở lại Mini App trong Zalo.`)), 20000);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export async function getZaloAccessToken(): Promise<string> {
  // login() only completes the Zalo OAuth step and returns "Success"; it is
  // never an access token. The backend must receive getAccessToken()'s value.
  try {
    await withTimeout(login(), 'Zalo đăng nhập');
  } catch (error) {
    throw new Error(`Zalo không mở được phiên đăng nhập (${zaloErrorDetail(error)}).`);
  }

  try {
    const accessToken = await withTimeout(getAccessToken(), 'Zalo cấp access token');
    if (accessToken && accessToken !== 'Success') return accessToken;
  } catch (error) {
    throw new Error(`Zalo không cấp access token (${zaloErrorDetail(error)}).`);
  }
  throw new Error('Zalo hoàn tất đăng nhập nhưng không trả access token. Hãy cập nhật và mở lại Mini App trong Zalo.');
}

export async function getZaloLocationToken(): Promise<string> {
  const result = await getLocation({});
  if (!result.token) throw new Error('Không lấy được vị trí. Hãy cấp quyền vị trí trong Zalo.');
  return result.token;
}
