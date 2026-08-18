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
import PersistenceManager, { PersistenceError } from './PersistenceManager';
import { $assert } from './util/assert';

export interface GoogleDriveApiAdapter {
  getFileContent: (fileId: string) => Promise<string>;
  saveFileContent?: (
    fileId: string,
    name: string,
    content: string,
  ) => Promise<{ id: string; name: string }>;
  updateFileContent?: (
    fileId: string,
    name: string,
    content: string,
  ) => Promise<{ id: string; name: string }>;
}

class GoogleDrivePersistenceManager extends PersistenceManager {
  private fileId: string;

  private fileName: string;

  private apiAdapter: GoogleDriveApiAdapter;

  constructor(fileId: string, fileName: string, apiAdapter: GoogleDriveApiAdapter) {
    super();
    $assert(fileId, 'Google Drive fileId must be defined');
    $assert(apiAdapter, 'Google Drive apiAdapter must be defined');
    this.fileId = fileId;
    this.fileName = fileName || 'Mindmap.wxml';
    this.apiAdapter = apiAdapter;
  }

  getFileId(): string {
    return this.fileId;
  }

  getFileName(): string {
    return this.fileName;
  }

  setFileName(fileName: string): void {
    this.fileName = fileName;
  }

  async loadMapDom(_mapId: string): Promise<Document> {
    try {
      const xmlString = await this.apiAdapter.getFileContent(this.fileId);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error(`XML parse error: ${parseError.textContent}`);
      }
      return doc;
    } catch (error) {
      const isAuthError =
        error instanceof Error &&
        (error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.toLowerCase().includes('auth') ||
          error.message.toLowerCase().includes('permission'));
      const err: PersistenceError = {
        errorType: isAuthError ? 'auth' : 'unexpected',
        severity: 'SEVERE',
        message: error instanceof Error ? error.message : 'Failed to load map from Google Drive',
      };
      this.triggerError(err);
      throw error;
    }
  }

  saveMapXml(
    _mapId: string,
    mapXml: Document,
    _pref?: string,
    _saveHistory?: boolean,
    events?: { onSuccess?: () => void; onError?: (err: unknown) => void },
  ): void {
    const xmlString = new XMLSerializer().serializeToString(mapXml);
    const saveFn = this.apiAdapter.saveFileContent
      ? this.apiAdapter.saveFileContent.bind(this.apiAdapter)
      : this.apiAdapter.updateFileContent?.bind(this.apiAdapter);

    if (!saveFn) {
      const err: PersistenceError = {
        errorType: 'unexpected',
        severity: 'SEVERE',
        message: 'No save function found on GoogleDriveApiAdapter',
      };
      this.triggerError(err);
      events?.onError?.(err);
      return;
    }

    saveFn(this.fileId, this.fileName, xmlString)
      .then(() => {
        events?.onSuccess?.();
      })
      .catch((error) => {
        const isAuthError =
          error instanceof Error &&
          (error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.toLowerCase().includes('auth') ||
            error.message.toLowerCase().includes('permission'));
        const err: PersistenceError = {
          errorType: isAuthError ? 'auth' : 'unexpected',
          severity: 'SEVERE',
          message: error instanceof Error ? error.message : 'Failed to save map to Google Drive',
        };
        this.triggerError(err);
        events?.onError?.(err);
      });
  }

  discardChanges(_mapId: string): void {
    // No local temporary storage to discard
  }

  unlockMap(_mapId: string): void {
    // Google Drive does not require server locks
  }
}

export default GoogleDrivePersistenceManager;
