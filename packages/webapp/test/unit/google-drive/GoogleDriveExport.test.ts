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
import { exportMindmapToGoogleDrive } from '../../../src/components/maps-page/action-dispatcher/export-dialog/GoogleDriveExportHandler';
import AppConfig from '../../../src/classes/app-config';
import GoogleDriveClient from '../../../src/classes/google-drive/GoogleDriveClient';
import GoogleAuthService from '../../../src/classes/google-drive/GoogleAuthService';

describe('GoogleDriveExportHandler', () => {
  const mockToken = 'ya29.export-token-123';
  const mockXml = '<map name="test-map"><topic text="Root" id="1"/></map>';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should authorize and save XML file to Google Drive', async () => {
    const mockRequestToken = jest.fn().mockResolvedValue(mockToken);
    const mockCreateFile = jest.fn().mockResolvedValue({
      id: 'gdrive-new-file-777',
      name: 'Strategy 2026.wxml',
    });

    jest.spyOn(AppConfig, 'getGoogleAuthService').mockReturnValue({
      requestToken: mockRequestToken,
    } as unknown as GoogleAuthService);

    jest.spyOn(AppConfig, 'getGoogleDriveClient').mockReturnValue({
      createFile: mockCreateFile,
    } as unknown as GoogleDriveClient);

    const result = await exportMindmapToGoogleDrive('Strategy 2026', mockXml);

    expect(mockRequestToken).toHaveBeenCalled();
    expect(mockCreateFile).toHaveBeenCalledWith('Strategy 2026.wxml', mockXml);
    expect(result).toEqual({
      id: 'gdrive-new-file-777',
      name: 'Strategy 2026.wxml',
    });
  });

  test('should append .wxml extension if not provided', async () => {
    const mockCreateFile = jest.fn().mockResolvedValue({
      id: 'gdrive-file-888',
      name: 'My Mindmap.wxml',
    });

    jest.spyOn(AppConfig, 'getGoogleAuthService').mockReturnValue({
      requestToken: jest.fn().mockResolvedValue(mockToken),
    } as unknown as GoogleAuthService);

    jest.spyOn(AppConfig, 'getGoogleDriveClient').mockReturnValue({
      createFile: mockCreateFile,
    } as unknown as GoogleDriveClient);

    await exportMindmapToGoogleDrive('My Mindmap', mockXml);

    expect(mockCreateFile).toHaveBeenCalledWith('My Mindmap.wxml', mockXml);
  });
});
