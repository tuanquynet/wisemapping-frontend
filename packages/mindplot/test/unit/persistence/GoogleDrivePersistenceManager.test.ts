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
import GoogleDrivePersistenceManager, {
  GoogleDriveApiAdapter,
} from '../../../src/components/GoogleDrivePersistenceManager';
import { PersistenceError } from '../../../src/components/PersistenceManager';

describe('GoogleDrivePersistenceManager', () => {
  let mockAdapter: GoogleDriveApiAdapter;
  let persistenceManager: GoogleDrivePersistenceManager;
  const fileId = 'gdrive-file-12345';
  const fileName = 'My Strategy.wxml';

  const validXml = '<map name="gdrive-map"><topic central="true" id="1" text="Central"/></map>';

  beforeEach(() => {
    mockAdapter = {
      getFileContent: jest.fn().mockResolvedValue(validXml),
      saveFileContent: jest.fn().mockResolvedValue({ id: fileId, name: fileName }),
    };
    persistenceManager = new GoogleDrivePersistenceManager(fileId, fileName, mockAdapter);
  });

  test('should initialize with fileId, fileName, and adapter', () => {
    expect(persistenceManager.getFileId()).toBe(fileId);
    expect(persistenceManager.getFileName()).toBe(fileName);
  });

  test('should update filename via setFileName', () => {
    persistenceManager.setFileName('Renamed Map.wxml');
    expect(persistenceManager.getFileName()).toBe('Renamed Map.wxml');
  });

  test('should load map XML DOM from adapter', async () => {
    const doc = await persistenceManager.loadMapDom(fileId);

    expect(mockAdapter.getFileContent).toHaveBeenCalledWith(fileId);
    expect(doc).toBeDefined();
    expect(doc.querySelector('topic')).not.toBeNull();
    expect(doc.querySelector('topic')?.getAttribute('text')).toBe('Central');
  });

  test('should handle and trigger error on invalid XML content', async () => {
    const corruptXml = '<map><topic unclosed tag>';
    (mockAdapter.getFileContent as jest.Mock).mockResolvedValueOnce(corruptXml);

    const errorHandler = jest.fn();
    persistenceManager.addErrorHandler(errorHandler);

    await expect(persistenceManager.loadMapDom(fileId)).rejects.toThrow();
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'SEVERE',
        errorType: 'unexpected',
      }),
    );
  });

  test('should save map XML DOM to adapter and call onSuccess', (done) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(validXml, 'text/xml');

    persistenceManager.saveMapXml(fileId, doc, undefined, false, {
      onSuccess: () => {
        expect(mockAdapter.saveFileContent).toHaveBeenCalledWith(
          fileId,
          fileName,
          expect.stringContaining('<map'),
        );
        done();
      },
      onError: (err) => {
        done(err);
      },
    });
  });

  test('should trigger error and call onError when adapter save fails', (done) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(validXml, 'text/xml');
    const saveError = new Error('Google Drive quota exceeded');
    (mockAdapter.saveFileContent as jest.Mock).mockRejectedValueOnce(saveError);

    const globalErrorHandler = jest.fn();
    persistenceManager.addErrorHandler(globalErrorHandler);

    persistenceManager.saveMapXml(fileId, doc, undefined, false, {
      onSuccess: () => {
        done(new Error('Should have failed'));
      },
      onError: (err: unknown) => {
        const persistenceErr = err as PersistenceError;
        expect(persistenceErr.message).toBe('Google Drive quota exceeded');
        expect(globalErrorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'SEVERE',
            message: 'Google Drive quota exceeded',
          }),
        );
        done();
      },
    });
  });
});
