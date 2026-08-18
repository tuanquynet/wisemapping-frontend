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
import { gdriveLoader } from '../../../src/components/editor-page/GoogleDriveEditorLoader';
import AppConfig from '../../../src/classes/app-config';
import GoogleDriveClient from '../../../src/classes/google-drive/GoogleDriveClient';

describe('GoogleDriveEditorLoader', () => {
  const mockFileId = 'gdrive-test-file-abc-123';
  const mockFileName = 'Q3 Product Strategy.wxml';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 if fileId is not provided in params', async () => {
    const loaderFn = gdriveLoader();
    const response = await loaderFn({ params: {} });

    expect(response.status).toBe(400);
  });

  test('should load metadata from Google Drive and return EditorMetadata JSON', async () => {
    const mockGetFileMetadata = jest.fn().mockResolvedValue({
      id: mockFileId,
      name: mockFileName,
      mimeType: 'application/xml',
    });

    const mockDriveClient = {
      getFileMetadata: mockGetFileMetadata,
      getFileContent: jest.fn(),
      createFile: jest.fn(),
      updateFileContent: jest.fn(),
    } as unknown as GoogleDriveClient;

    jest.spyOn(AppConfig, 'getGoogleDriveClient').mockReturnValue(mockDriveClient);

    const loaderFn = gdriveLoader();
    const response = await loaderFn({ params: { fileId: mockFileId } });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(mockGetFileMetadata).toHaveBeenCalledWith(mockFileId);
    expect(data.editorMode).toBe('edition-owner');
    expect(data.gdriveFileId).toBe(mockFileId);
    expect(data.gdriveFileName).toBe(mockFileName);
    expect(data.mapMetadata.title).toBe('Q3 Product Strategy');
  });
});
