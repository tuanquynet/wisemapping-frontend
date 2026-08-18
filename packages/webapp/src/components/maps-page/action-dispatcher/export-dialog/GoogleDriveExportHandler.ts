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

import AppConfig from '../../../../classes/app-config';

export interface GoogleDriveExportResult {
  id: string;
  name: string;
}

/**
 * Saves/exports a mindmap XML string directly to Google Drive as a .wxml file.
 *
 * @param fileName - Target file name
 * @param xmlContent - The serialized mindmap XML string
 * @param parentFolderId - Optional Google Drive parent folder ID
 * @returns Promise resolving to the created file metadata { id, name }
 */
export async function exportMindmapToGoogleDrive(
  fileName: string,
  xmlContent: string,
  parentFolderId?: string,
): Promise<GoogleDriveExportResult> {
  const authService = AppConfig.getGoogleAuthService();
  await authService.requestToken();

  const driveClient = AppConfig.getGoogleDriveClient();

  // Ensure .wxml extension
  const finalFileName =
    fileName.trim().toLowerCase().endsWith('.wxml') ||
    fileName.trim().toLowerCase().endsWith('.xml')
      ? fileName.trim()
      : `${fileName.trim()}.wxml`;

  if (parentFolderId) {
    return driveClient.createFile(finalFileName, xmlContent, parentFolderId);
  }
  return driveClient.createFile(finalFileName, xmlContent);
}
