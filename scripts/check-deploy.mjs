import { existsSync, readFileSync } from 'node:fs';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const apiUrl = env.VITE_API_BASE_URL?.trim();
let failed = false;

if (!apiUrl) {
  console.error('FAIL: Thiếu VITE_API_BASE_URL cho bản deploy.');
  failed = true;
} else {
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname.endsWith('.example')) {
      console.error('FAIL: VITE_API_BASE_URL phải là URL HTTPS thật của backend Workly.');
      failed = true;
    } else {
      console.log(`OK: API HTTPS ${parsed.origin}`);
    }
  } catch {
    console.error('FAIL: VITE_API_BASE_URL không phải URL hợp lệ.');
    failed = true;
  }
}

try {
  const app = JSON.parse(readFileSync('app-config.json', 'utf8'));
  if (!app.app?.title) throw new Error('Thiếu app.title');
  console.log('OK: app-config.json');
} catch (error) {
  console.error(`FAIL: app-config.json không hợp lệ: ${error.message}`);
  failed = true;
}

if (!existsSync('www/index.html') || !existsSync('www/app-config.json')) {
  console.error('FAIL: Chưa có bản build trong www/. Chạy npm run build.');
  failed = true;
} else {
  console.log('OK: www/ đã có bản build');
}

if (!existsSync('package-lock.json')) {
  console.warn('WARN: Chưa có package-lock.json; cần tạo lockfile để cài đặt lặp lại đúng phiên bản.');
}

if (failed) process.exitCode = 1;
