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
import GoogleDriveClient from '../../../src/classes/google-drive/GoogleDriveClient';

describe('GoogleDriveClient', () => {
  let client: GoogleDriveClient;
  const mockToken = 'test-bearer-token-123';
  const tokenProvider = jest.fn().mockResolvedValue(mockToken);
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new GoogleDriveClient(tokenProvider);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('should get file metadata from Google Drive API v3', async () => {
    const mockFileMetadata = {
      id: 'gdrive-file-id-1',
      name: 'Project Roadmap.wxml',
      mimeType: 'application/xml',
      modifiedTime: '2026-08-17T10:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFileMetadata,
    });

    const result = await client.getFileMetadata('gdrive-file-id-1');

    expect(result).toEqual(mockFileMetadata);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/drive/v3/files/gdrive-file-id-1'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      }),
    );
  });

  test('should get file content (XML text) from Google Drive', async () => {
    const mockXml = '<map name="gdrive-map"><topic text="Root" id="1"/></map>';

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockXml,
    });

    const content = await client.getFileContent('gdrive-file-id-1');

    expect(content).toBe(mockXml);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/drive/v3/files/gdrive-file-id-1?alt=media'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      }),
    );
  });

  test('should create a new file with multipart upload', async () => {
    const mockCreated = {
      id: 'new-gdrive-id-99',
      name: 'New Mindmap.wxml',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCreated,
    });

    const created = await client.createFile('New Mindmap.wxml', '<map name="new"/>');

    expect(created).toEqual(mockCreated);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/upload/drive/v3/files?uploadType=multipart'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      }),
    );
  });

  test('should update existing file content with multipart upload', async () => {
    const mockUpdated = {
      id: 'gdrive-file-id-1',
      name: 'Project Roadmap.wxml',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockUpdated,
    });

    const updated = await client.updateFileContent(
      'gdrive-file-id-1',
      'Project Roadmap.wxml',
      '<map name="updated"/>',
    );

    expect(updated).toEqual(mockUpdated);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/upload/drive/v3/files/gdrive-file-id-1?uploadType=multipart'),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      }),
    );
  });

  test('should throw meaningful error on 401 unauthorized', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid Credentials',
    });

    await expect(client.getFileMetadata('unauth-file-id')).rejects.toThrow('Authentication failed: Invalid Credentials');
  });
});
