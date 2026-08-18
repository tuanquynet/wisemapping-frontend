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

export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  capabilities?: {
    canEdit?: boolean;
    canComment?: boolean;
    canShare?: boolean;
  };
}

export type TokenProvider = () => Promise<string>;

const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3';

class GoogleDriveClient {
  private tokenProvider: TokenProvider;

  constructor(tokenProvider: TokenProvider) {
    this.tokenProvider = tokenProvider;
  }

  private async buildAuthHeaders(contentType?: string): Promise<Record<string, string>> {
    const token = await this.tokenProvider();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  private async handleResponseError(response: Response): Promise<never> {
    const responseText = await response.text();
    if (response.status === 401) {
      throw new Error(`Authentication failed: ${responseText}`);
    }
    if (response.status === 403) {
      throw new Error(`Permission denied: ${responseText}`);
    }
    if (response.status === 404) {
      throw new Error(`File not found: ${responseText}`);
    }
    throw new Error(`Google Drive API error (${response.status}): ${responseText}`);
  }

  async getFileMetadata(fileId: string): Promise<GoogleDriveFileMetadata> {
    const headers = await this.buildAuthHeaders();
    const url = `${DRIVE_API_BASE_URL}/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,capabilities`;
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      await this.handleResponseError(response);
    }

    return (await response.json()) as GoogleDriveFileMetadata;
  }

  async getFileContent(fileId: string): Promise<string> {
    const headers = await this.buildAuthHeaders();
    const url = `${DRIVE_API_BASE_URL}/files/${fileId}?alt=media`;
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      await this.handleResponseError(response);
    }

    return response.text();
  }

  async createFile(
    name: string,
    content: string,
    parentFolderId?: string,
  ): Promise<{ id: string; name: string }> {
    const boundary = `-------wisemapping_multipart_boundary_${Date.now()}`;
    const headers = await this.buildAuthHeaders(`multipart/related; boundary=${boundary}`);

    const metadata: { name: string; mimeType: string; parents?: string[] } = {
      name,
      mimeType: 'application/xml',
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/xml; charset=UTF-8',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const url = `${DRIVE_UPLOAD_BASE_URL}/files?uploadType=multipart`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: multipartBody,
    });

    if (!response.ok) {
      await this.handleResponseError(response);
    }

    return (await response.json()) as { id: string; name: string };
  }

  async updateFileContent(
    fileId: string,
    name: string,
    content: string,
  ): Promise<{ id: string; name: string }> {
    const boundary = `-------wisemapping_multipart_boundary_${Date.now()}`;
    const headers = await this.buildAuthHeaders(`multipart/related; boundary=${boundary}`);

    const metadata = {
      name,
      mimeType: 'application/xml',
    };

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/xml; charset=UTF-8',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const url = `${DRIVE_UPLOAD_BASE_URL}/files/${fileId}?uploadType=multipart`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: multipartBody,
    });

    if (!response.ok) {
      await this.handleResponseError(response);
    }

    return (await response.json()) as { id: string; name: string };
  }
  async saveFileContent(
    fileId: string,
    name: string,
    content: string,
  ): Promise<{ id: string; name: string }> {
    return this.updateFileContent(fileId, name, content);
  }
}

export default GoogleDriveClient;
