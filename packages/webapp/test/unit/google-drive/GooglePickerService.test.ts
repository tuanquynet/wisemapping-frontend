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
import GooglePickerService, { PickerPickedFile } from '../../../src/classes/google-drive/GooglePickerService';
import type { GooglePickerCallbackData } from '../../../src/@types/google';

describe('GooglePickerService', () => {
  let pickerService: GooglePickerService;
  const mockToken = 'ya29.mock-picker-token';
  const mockApiKey = 'mock-google-api-key';

  beforeEach(() => {
    pickerService = new GooglePickerService(mockApiKey);
    delete window.gapi;
    delete window.google;
  });

  test('should initialize with API key', () => {
    expect(pickerService.getApiKey()).toBe(mockApiKey);
  });

  test('should build and open Google Picker and invoke callback on file select', async () => {
    const mockSetVisible = jest.fn();
    const mockBuild = jest.fn().mockReturnValue({ setVisible: mockSetVisible });
    const mockSetCallback = jest.fn();
    const mockSetOAuthToken = jest.fn();
    const mockSetDeveloperKey = jest.fn();
    const mockAddView = jest.fn();
    const mockSetMimeTypes = jest.fn();

    let pickerCallback: ((data: GooglePickerCallbackData) => void) | undefined;
    mockSetCallback.mockImplementation((cb: (data: GooglePickerCallbackData) => void) => {
      pickerCallback = cb;
      return {
        build: mockBuild,
        setOAuthToken: mockSetOAuthToken,
        setDeveloperKey: mockSetDeveloperKey,
        addView: mockAddView,
        setCallback: mockSetCallback,
      };
    });

    window.gapi = {
      load: jest.fn().mockImplementation((_lib: string, callback: () => void) => {
        callback();
      }),
    };

    window.google = {
      picker: {
        PickerBuilder: jest.fn().mockImplementation(() => ({
          addView: mockAddView.mockReturnThis(),
          setOAuthToken: mockSetOAuthToken.mockReturnThis(),
          setDeveloperKey: mockSetDeveloperKey.mockReturnThis(),
          setCallback: mockSetCallback,
          build: mockBuild,
        })),
        View: jest.fn().mockImplementation(() => ({
          setMimeTypes: mockSetMimeTypes.mockReturnThis(),
        })),
        ViewId: {
          DOCS: 'all-docs',
        },
        Action: {
          PICKED: 'picked',
          CANCEL: 'cancel',
        },
        Response: {
          ACTION: 'action',
          DOCUMENTS: 'docs',
        },
        Document: {
          ID: 'id',
          NAME: 'name',
          MIME_TYPE: 'mimeType',
        },
      },
    };

    let resolvePicked: ((file: PickerPickedFile) => void) | undefined;
    const pickedPromise = new Promise<PickerPickedFile>((resolve) => {
      resolvePicked = resolve;
    });

    await pickerService.showPicker({
      token: mockToken,
      onPicked: (file) => resolvePicked?.(file),
    });

    expect(mockAddView).toHaveBeenCalled();
    expect(mockSetOAuthToken).toHaveBeenCalledWith(mockToken);
    expect(mockSetDeveloperKey).toHaveBeenCalledWith(mockApiKey);
    expect(mockSetVisible).toHaveBeenCalledWith(true);

    // Simulate Google Picker file pick
    if (pickerCallback) {
      pickerCallback({
        action: 'picked',
        docs: [
          {
            id: 'picked-file-999',
            name: 'Strategy Map.wxml',
            mimeType: 'application/xml',
          },
        ],
      });
    }

    const pickedFile = await pickedPromise;
    expect(pickedFile).toEqual({
      id: 'picked-file-999',
      name: 'Strategy Map.wxml',
      mimeType: 'application/xml',
    });
  });
});
