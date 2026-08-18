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

class FallbackResponse {
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  private readonly bodyContent: string;
  readonly headers: Headers;

  constructor(body?: string | null, init?: ResponseInit) {
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? (this.status >= 200 && this.status < 300 ? 'OK' : '');
    this.ok = this.status >= 200 && this.status < 300;
    this.bodyContent = body ?? '';
    this.headers = new (typeof Headers !== 'undefined' ? Headers : FallbackHeaders)(
      init?.headers,
    ) as unknown as Headers;
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyContent);
  }

  async text(): Promise<string> {
    return this.bodyContent;
  }
}

class FallbackHeaders {
  private map: Map<string, string> = new Map();

  constructor(init?: HeadersInit) {
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([k, v]) => this.map.set(k.toLowerCase(), v));
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([k, v]) => this.map.set(k.toLowerCase(), v));
      }
    }
  }

  get(name: string): string | null {
    return this.map.get(name.toLowerCase()) ?? null;
  }

  set(name: string, value: string): void {
    this.map.set(name.toLowerCase(), value);
  }

  has(name: string): boolean {
    return this.map.has(name.toLowerCase());
  }
}

function getResponseClass(): typeof Response {
  if (typeof Response !== 'undefined') {
    return Response;
  }
  if (typeof globalThis !== 'undefined' && globalThis.Response) {
    return globalThis.Response;
  }
  return FallbackResponse as unknown as typeof Response;
}

/**
 * Creates a Response object with JSON content.
 * Uses Response.json() if available, otherwise falls back to manual Response creation.
 * This ensures compatibility across different browser and runtime environments.
 *
 * @param data - The data to serialize as JSON
 * @param init - Optional ResponseInit object for status, headers, etc.
 * @returns A Response object with JSON content
 */
export function createJsonResponse(data: unknown, init?: ResponseInit): Response {
  const ResponseClass = getResponseClass();
  if (typeof ResponseClass.json === 'function') {
    return ResponseClass.json(data, init);
  }

  return new ResponseClass(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

/**
 * Creates an error Response object with text or JSON content.
 */
export function createErrorResponse(message: string, status = 500, statusText?: string): Response {
  const ResponseClass = getResponseClass();
  return new ResponseClass(message, {
    status,
    statusText: statusText || (status === 400 ? 'Bad Request' : 'Internal Server Error'),
  });
}
