/*
 *    Copyright [2007-2025] [wisemapping]
 *
 *   Licensed under WiseMapping Public License, Version 1.0 (the "License").
 *   It is basically the Apache License, Version 2.0 (the "License") plus the
 *   "powered by wisemapping" text requirement on every single page;
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the license at
 *
 *       https://github.com/wisemapping/wisemapping-open-source/blob/main/LICENSE.md
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import type { GoogleTokenResponse as TokenResponse } from '../../@types/google';
export type { GoogleTokenResponse as TokenResponse } from '../../@types/google';
import AppConfig from '../app-config';

const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000; // 1 minute safety buffer

class GoogleAuthService {
  private static readonly STORAGE_KEY = 'wisemapping_gdrive_auth_token';
  private static readonly EXPIRY_KEY = 'wisemapping_gdrive_auth_expires_at';

  private clientId: string;
  private scopes: string[];
  private accessToken: string | null = null;
  private expiresAt: number | null = null;
  private gisLoadingPromise: Promise<void> | null = null;

  constructor(clientId?: string, scopes: string[] = DEFAULT_SCOPES) {
    this.clientId = clientId || AppConfig.getGoogleClientId();
    this.scopes = scopes;
    this.restoreTokenFromStorage();
  }

  private restoreTokenFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const token =
        window.sessionStorage?.getItem(GoogleAuthService.STORAGE_KEY) ||
        window.localStorage?.getItem(GoogleAuthService.STORAGE_KEY);
      const expiresAtStr =
        window.sessionStorage?.getItem(GoogleAuthService.EXPIRY_KEY) ||
        window.localStorage?.getItem(GoogleAuthService.EXPIRY_KEY);

      if (token && expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (!Number.isNaN(expiresAt) && Date.now() < expiresAt) {
          this.accessToken = token;
          this.expiresAt = expiresAt;
        } else {
          this.clearToken();
        }
      }
    } catch {
      // ignore storage access errors
    }
  }

  getClientId(): string {
    return this.clientId;
  }

  getScopes(): string[] {
    return this.scopes;
  }

  getToken(): string | null {
    if (!this.accessToken || !this.expiresAt) {
      this.restoreTokenFromStorage();
    }
    if (!this.hasValidToken()) {
      this.clearToken();
      return null;
    }
    return this.accessToken;
  }

  hasValidToken(): boolean {
    if (!this.accessToken || !this.expiresAt) {
      this.restoreTokenFromStorage();
    }
    if (!this.accessToken || !this.expiresAt) {
      return false;
    }
    return Date.now() < this.expiresAt;
  }

  setToken(token: string, expiresInSeconds: number | string): void {
    this.accessToken = token;
    const rawSeconds =
      typeof expiresInSeconds === 'string'
        ? parseInt(expiresInSeconds, 10)
        : Number(expiresInSeconds);
    const seconds = Number.isFinite(rawSeconds) ? rawSeconds : 3600;
    this.expiresAt = Date.now() + seconds * 1000 - (seconds > 0 ? TOKEN_EXPIRY_BUFFER_MS : 0);
    try {
      window.sessionStorage?.setItem(GoogleAuthService.STORAGE_KEY, token);
      window.sessionStorage?.setItem(GoogleAuthService.EXPIRY_KEY, String(this.expiresAt));
      window.localStorage?.setItem(GoogleAuthService.STORAGE_KEY, token);
      window.localStorage?.setItem(GoogleAuthService.EXPIRY_KEY, String(this.expiresAt));
    } catch {
      // ignore storage errors
    }
  }

  clearToken(): void {
    this.accessToken = null;
    this.expiresAt = null;
    try {
      window.sessionStorage?.removeItem(GoogleAuthService.STORAGE_KEY);
      window.sessionStorage?.removeItem(GoogleAuthService.EXPIRY_KEY);
      window.localStorage?.removeItem(GoogleAuthService.STORAGE_KEY);
      window.localStorage?.removeItem(GoogleAuthService.EXPIRY_KEY);
    } catch {
      // ignore storage errors
    }
  }

  loadGisScript(): Promise<void> {
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
      return Promise.resolve();
    }

    if (this.gisLoadingPromise) {
      return this.gisLoadingPromise;
    }

    this.gisLoadingPromise = new Promise<void>((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Document is not available'));
        return;
      }

      const onLoaded = (): void => {
        if (window.google?.accounts?.oauth2) {
          resolve();
        } else {
          // Poll briefly in case google.accounts.oauth2 takes a tick to attach
          let attempts = 0;
          const interval = setInterval(() => {
            attempts += 1;
            if (window.google?.accounts?.oauth2) {
              clearInterval(interval);
              resolve();
            } else if (attempts > 50) {
              clearInterval(interval);
              reject(new Error('Google GIS script loaded but google.accounts.oauth2 is missing'));
            }
          }, 50);
        }
      };

      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_SCRIPT_URL}"]`,
      );
      if (existingScript) {
        if (window.google?.accounts?.oauth2) {
          resolve();
          return;
        }
        existingScript.addEventListener('load', onLoaded);
        existingScript.addEventListener('error', () => {
          this.gisLoadingPromise = null;
          reject(new Error('Failed to load Google GIS script'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = onLoaded;
      script.onerror = () => {
        this.gisLoadingPromise = null;
        reject(new Error('Failed to load Google GIS script'));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      this.gisLoadingPromise = null;
      throw err;
    });

    return this.gisLoadingPromise;
  }

  async requestToken(prompt?: string): Promise<string> {
    const existingToken = this.getToken();
    if (existingToken && !prompt) {
      return existingToken;
    }

    await this.loadGisScript();

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      throw new Error('Google Identity Services (GIS) failed to initialize');
    }

    return new Promise<string>((resolve, reject) => {
      try {
        const client = oauth2.initTokenClient({
          client_id: this.clientId,
          scope: this.scopes.join(' '),
          callback: (response: TokenResponse) => {
            if (response.error) {
              const errorMessage =
                response.error_description || response.error || 'OAuth2 authentication failed';
              this.clearToken();
              reject(new Error(errorMessage));
              return;
            }

            if (!response.access_token) {
              this.clearToken();
              reject(new Error('No access token received from Google'));
              return;
            }

            const expiresIn = response.expires_in !== undefined ? response.expires_in : 3600;
            this.setToken(response.access_token, expiresIn);
            resolve(response.access_token);
          },
          error_callback: (error: unknown) => {
            this.clearToken();
            const message = error instanceof Error ? error.message : 'Google OAuth2 client error';
            reject(new Error(message));
          },
        });

        client.requestAccessToken(prompt ? { prompt } : undefined);
      } catch (err) {
        this.clearToken();
        const message =
          err instanceof Error ? err.message : 'Failed to request Google access token';
        reject(new Error(message));
      }
    });
  }
}

export default GoogleAuthService;
