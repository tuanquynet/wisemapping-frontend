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
import GoogleAuthService from '../../../src/classes/google-drive/GoogleAuthService';

describe('GoogleAuthService', () => {
  let authService: GoogleAuthService;
  const mockClientId = 'test-google-client-id.apps.googleusercontent.com';

  beforeEach(() => {
    window.sessionStorage?.clear();
    window.localStorage?.clear();
    authService = new GoogleAuthService(mockClientId);
    delete window.google;
  });

  test('should initialize with client ID and have no active token initially', () => {
    expect(authService.getClientId()).toBe(mockClientId);
    expect(authService.hasValidToken()).toBe(false);
    expect(authService.getToken()).toBeNull();
  });

  test('should set and retrieve in-memory token with expiration', () => {
    const fakeToken = 'ya29.fake-test-token-123';
    authService.setToken(fakeToken, 3600); // 1 hour

    expect(authService.hasValidToken()).toBe(true);
    expect(authService.getToken()).toBe(fakeToken);
  });

  test('should report expired token when time expires', () => {
    const fakeToken = 'ya29.fake-expired-token';
    authService.setToken(fakeToken, -10); // Expired 10 seconds ago

    expect(authService.hasValidToken()).toBe(false);
    expect(authService.getToken()).toBeNull();
  });

  test('should clear token properly', () => {
    authService.setToken('ya29.test-token', 3600);
    expect(authService.hasValidToken()).toBe(true);

    authService.clearToken();
    expect(authService.hasValidToken()).toBe(false);
    expect(authService.getToken()).toBeNull();
  });
  test('should persist token across instances via session storage', () => {
    const testToken = 'ya29.persisted-token-456';
    authService.setToken(testToken, 3600);

    // Create a new service instance (simulating page reload/navigation)
    const newService = new GoogleAuthService(mockClientId);
    expect(newService.hasValidToken()).toBe(true);
    expect(newService.getToken()).toBe(testToken);
  });


  test('should request token via GIS TokenClient when no valid token exists', async () => {
    const mockRequestAccessToken = jest.fn();
    let callbackRef: ((resp: { access_token?: string; expires_in?: number; error?: string }) => void) | undefined;

    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: jest.fn().mockImplementation((config: { callback: (resp: unknown) => void }) => {
            callbackRef = config.callback;
            return {
              requestAccessToken: mockRequestAccessToken.mockImplementation(() => {
                if (callbackRef) {
                  callbackRef({
                    access_token: 'ya29.gis-generated-token',
                    expires_in: 3600,
                  });
                }
              }),
            };
          }),
        },
      },
    };

    const tokenPromise = authService.requestToken();
    const token = await tokenPromise;

    expect(token).toBe('ya29.gis-generated-token');
    expect(authService.hasValidToken()).toBe(true);
    expect(authService.getToken()).toBe('ya29.gis-generated-token');
  });

  test('should reject requestToken on GIS oauth error', async () => {
    let callbackRef: ((resp: { error?: string; error_description?: string }) => void) | undefined;

    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: jest.fn().mockImplementation((config: { callback: (resp: unknown) => void }) => {
            callbackRef = config.callback;
            return {
              requestAccessToken: jest.fn().mockImplementation(() => {
                if (callbackRef) {
                  callbackRef({
                    error: 'access_denied',
                    error_description: 'User denied permission',
                  });
                }
              }),
            };
          }),
        },
      },
    };

    await expect(authService.requestToken()).rejects.toThrow('User denied permission');
  });
});
