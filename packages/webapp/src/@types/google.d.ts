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

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: unknown) => void;
}

export interface GooglePickerDocument {
  id: string;
  name: string;
  mimeType: string;
}

export interface GooglePickerCallbackData {
  action: string;
  docs?: GooglePickerDocument[];
  [key: string]: unknown;
}

export interface GooglePickerView {
  setMimeTypes: (mimeTypes: string) => GooglePickerView;
}

export interface GooglePickerInstance {
  setVisible: (visible: boolean) => void;
}

export interface GooglePickerBuilderInstance {
  addView: (view: unknown) => GooglePickerBuilderInstance;
  setOAuthToken: (token: string) => GooglePickerBuilderInstance;
  setDeveloperKey: (key: string) => GooglePickerBuilderInstance;
  setTitle?: (title: string) => GooglePickerBuilderInstance;
  setCallback: (callback: (data: GooglePickerCallbackData) => void) => GooglePickerBuilderInstance;
  build: () => GooglePickerInstance;
}

export interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilderInstance;
  View: new (viewId: string) => GooglePickerView;
  ViewId: {
    DOCS: string;
  };
  Action: {
    PICKED: string;
    CANCEL: string;
  };
  Response: {
    ACTION: string;
    DOCUMENTS: string;
  };
  Document: {
    ID: string;
    NAME: string;
    MIME_TYPE: string;
  };
}

export interface GoogleAccountsNamespace {
  oauth2: {
    initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
  };
}

export interface GoogleGlobalNamespace {
  accounts?: GoogleAccountsNamespace;
  picker?: GooglePickerNamespace;
}

export interface GapiGlobalNamespace {
  load: (apiName: string, callback: () => void) => void;
}

declare global {
  interface Window {
    google?: GoogleGlobalNamespace;
    gapi?: GapiGlobalNamespace;
  }
}
