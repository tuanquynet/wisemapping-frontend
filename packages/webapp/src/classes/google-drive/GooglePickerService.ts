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

export interface PickerPickedFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface ShowPickerOptions {
  token: string;
  title?: string;
  onPicked: (file: PickerPickedFile) => void;
  onCancel?: () => void;
}

import type {
  GooglePickerCallbackData as PickerCallbackData,
  GooglePickerDocument as PickerDocument,
} from '../../@types/google';
const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const SUPPORTED_MIME_TYPES = 'application/xml,text/xml,.wxml,application/octet-stream';

class GooglePickerService {
  private apiKey: string;
  private gapiLoadingPromise: Promise<void> | null = null;

  constructor(apiKey = '') {
    this.apiKey = apiKey;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  loadPickerApi(): Promise<void> {
    if (typeof window !== 'undefined' && window.google?.picker) {
      return Promise.resolve();
    }

    if (this.gapiLoadingPromise) {
      return this.gapiLoadingPromise;
    }

    this.gapiLoadingPromise = new Promise<void>((resolve, reject) => {
      if (window.gapi) {
        window.gapi.load('picker', () => {
          resolve();
        });
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${GAPI_SCRIPT_URL}"]`,
      );
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.gapi) {
            window.gapi.load('picker', () => resolve());
          } else {
            reject(new Error('Google API (gapi) script loaded but object missing'));
          }
        });
        existingScript.addEventListener('error', () => {
          this.gapiLoadingPromise = null;
          reject(new Error('Failed to load Google API script'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = GAPI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', () => {
            resolve();
          });
        } else {
          this.gapiLoadingPromise = null;
          reject(new Error('Google API (gapi) script loaded but object missing'));
        }
      };
      script.onerror = () => {
        this.gapiLoadingPromise = null;
        reject(new Error('Failed to load Google API script'));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      this.gapiLoadingPromise = null;
      throw err;
    });

    return this.gapiLoadingPromise;
  }

  async showPicker(options: ShowPickerOptions): Promise<void> {
    await this.loadPickerApi();

    if (!window.google?.picker) {
      throw new Error('Google Picker API is not available');
    }

    const { picker } = window.google;
    const view = new picker.View(picker.ViewId.DOCS);
    view.setMimeTypes(SUPPORTED_MIME_TYPES);

    const builder = new picker.PickerBuilder();
    builder.addView(view);
    builder.setOAuthToken(options.token);

    if (this.apiKey) {
      builder.setDeveloperKey(this.apiKey);
    }

    if (options.title && builder.setTitle) {
      builder.setTitle(options.title);
    }

    builder.setCallback((data: PickerCallbackData) => {
      const action = data[picker.Response.ACTION] || data.action;
      if (action === picker.Action.PICKED) {
        const docs = (data[picker.Response.DOCUMENTS] || data.docs) as PickerDocument[] | undefined;
        if (docs && docs.length > 0) {
          const doc = docs[0];
          options.onPicked({
            id: doc[picker.Document?.ID as keyof PickerDocument] || doc.id,
            name: doc[picker.Document?.NAME as keyof PickerDocument] || doc.name,
            mimeType: doc[picker.Document?.MIME_TYPE as keyof PickerDocument] || doc.mimeType,
          });
        }
      } else if (action === picker.Action.CANCEL) {
        options.onCancel?.();
      }
    });

    const pickerInstance = builder.build();
    pickerInstance.setVisible(true);
  }
}

export default GooglePickerService;
