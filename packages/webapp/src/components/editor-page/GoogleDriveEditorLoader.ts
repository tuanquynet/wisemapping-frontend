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

import AppConfig from '../../classes/app-config';
import { createJsonResponse, createErrorResponse } from '../../utils/response';
import type { EditorMetadata } from './loader';

export const gdriveLoader = () => {
  return async ({ params }: { params: { fileId?: string } }): Promise<Response> => {
    const fileId = params.fileId;
    if (!fileId) {
      return createErrorResponse('Google Drive file ID is required', 400);
    }

    try {
      const driveClient = AppConfig.getGoogleDriveClient();
      const metadata = await driveClient.getFileMetadata(fileId);

      const title = metadata.name
        ? metadata.name.replace(/\.(wxml|xml)$/i, '')
        : 'Google Drive Mindmap';

      // Link record in database in background if authenticated
      try {
        if (AppConfig.isRestClient()) {
          const client = AppConfig.getClient();
          if (client) {
            client
              .createMap({
                title,
                sourceType: 'gdrive',
                sourceId: fileId,
              })
              .catch(() => {
                // ignore background sync errors
              });
          }
        }
      } catch {
        // ignore
      }

      const editorMetadata: EditorMetadata = {
        editorMode: 'edition-owner',
        mapMetadata: {
          id: -1,
          title,
          creatorFullName: 'Google Drive User',
          isLocked: false,
          role: 'owner',
          jsonProps: '{ "zoom": 0.8 }',
        },
        zoom: 0.8,
        gdriveFileId: fileId,
        gdriveFileName: metadata.name || `${title}.wxml`,
      };

      return createJsonResponse(editorMetadata);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load Google Drive file metadata';
      return createErrorResponse(errorMessage, 500);
    }
  };
};
