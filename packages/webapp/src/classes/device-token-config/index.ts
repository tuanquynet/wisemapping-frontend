const DEVICE_TOKEN_KEY = 'wisemapping-device-token';

/**
 * Manages client-side custody of the X-Device-Token in localStorage (D12, AR17).
 * Transport is via header rather than cookie because the frontend SPA and API
 * occupy split registrable domains in production.
 */
class DeviceTokenConfig {
  static storeToken(token: string): void {
    try {
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    } catch {
      // localStorage may fail in private mode or if quota exceeded
    }
  }

  static retrieveToken(): string | null {
    try {
      return localStorage.getItem(DEVICE_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static removeToken(): void {
    try {
      localStorage.removeItem(DEVICE_TOKEN_KEY);
    } catch {
      // ignore removal failure
    }
  }
}

export default DeviceTokenConfig;
