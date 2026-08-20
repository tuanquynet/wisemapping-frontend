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

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-intl', () => {
  const ReactActual = require('react');
  return {
    FormattedMessage: ({ defaultMessage, id }: { defaultMessage?: string; id?: string }) =>
      ReactActual.createElement('span', null, defaultMessage || id),
    useIntl: () => ({
      formatMessage: ({ defaultMessage, id }: { defaultMessage?: string; id?: string }) =>
        defaultMessage || id,
    }),
    IntlProvider: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});
jest.mock('../../../mindplot/src/components/SvgImageIcon', () => ({
  default: jest.fn(),
}));

jest.mock('../../../mindplot/src/components/export/PDFExporter', () => ({
  __esModule: true,
  default: class {},
}));
import SaveAsDialog, * as SaveAsDialogModule from '../../src/components/maps-page/action-dispatcher/save-as-dialog';
import { ClientContext } from '../../src/classes/provider/client-context';
import Client from '../../src/classes/client';
import * as GoogleDriveExportHandler from '../../src/components/maps-page/action-dispatcher/export-dialog/GoogleDriveExportHandler';
import * as PersistenceManagerUtils from '../../src/components/editor-page/PersistenceManagerUtils';
import { TextExporterFactory, Exporter } from '@wisemapping/editor';
jest.mock('../../src/classes/middleware', () => ({
  useFetchMapById: jest.fn().mockReturnValue({
    data: {
      id: 101,
      title: 'Original Mindmap',
      description: 'Original Description',
    },
  }),
}));

const mockDuplicateMap = jest.fn().mockResolvedValue(202);
const mockCreateMap = jest.fn().mockResolvedValue(203);

const mockClient = {
  duplicateMap: mockDuplicateMap,
  createMap: mockCreateMap,
} as unknown as Client;

const renderComponent = (mapId = 101, onClose = jest.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientContext.Provider value={mockClient}>
        <SaveAsDialog mapId={mapId} onClose={onClose} />
      </ClientContext.Provider>
    </QueryClientProvider>,
  );
};

describe('SaveAsDialog', () => {
  let redirectSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectSpy = jest.spyOn(SaveAsDialogModule, 'redirectTo').mockImplementation();
  });
  it('renders destination selector, title input, and description', async () => {
    renderComponent();

    const titleInput = await screen.findByDisplayValue('Copy of Original Mindmap');
    expect(titleInput).toBeDefined();
    expect(screen.getByLabelText('WiseMapping Server')).toBeDefined();
    expect(screen.getByLabelText('Google Drive')).toBeDefined();
  });

  it('submits internal save and redirects to new map edit URL', async () => {
    renderComponent(101);

    const titleInput = await screen.findByDisplayValue('Copy of Original Mindmap');
    fireEvent.change(titleInput, { target: { value: 'New Copy Map' } });

    const submitButtons = screen.getAllByRole('button', { name: /save as/i });
    const submitButton = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockDuplicateMap).toHaveBeenCalledWith(101, {
        title: 'New Copy Map',
        description: 'Original Description',
      });
      expect(redirectSpy).toHaveBeenCalledWith('/c/maps/202/edit');
    });
  });

  it('submits Google Drive save and redirects to gdrive edit URL', async () => {
    jest.spyOn(PersistenceManagerUtils, 'fetchMindmap').mockResolvedValue({} as unknown as never);
    jest.spyOn(TextExporterFactory, 'create').mockReturnValue({
      export: jest.fn().mockResolvedValue('<map name="test"><topic text="Root" id="1"/></map>'),
      exportAndEncode: jest.fn().mockResolvedValue('<map name="test"><topic text="Root" id="1"/></map>'),
    } as unknown as Exporter);
    const exportSpy = jest.spyOn(GoogleDriveExportHandler, 'exportMindmapToGoogleDrive').mockResolvedValue({
      id: 'gdrive-file-999',
      name: 'Google Copy Map.wxml',
    });

    renderComponent(101);
    const gdriveRadio = screen.getByLabelText('Google Drive');
    fireEvent.click(gdriveRadio);

    const alertText = await screen.findByText(/saved as a \.wxml file to your Google Drive account/i);
    expect(alertText).toBeDefined();

    const titleInput = screen.getByDisplayValue('Copy of Original Mindmap');
    fireEvent.change(titleInput, { target: { value: 'Google Copy Map' } });

    const submitButtons = screen.getAllByRole('button', { name: /save as/i });
    const submitButton = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith(
        'Google Copy Map',
        expect.any(String),
      );
      expect(mockCreateMap).toHaveBeenCalledWith({
        title: 'Google Copy Map',
        sourceType: 'gdrive',
        sourceId: 'gdrive-file-999',
      });
      expect(redirectSpy).toHaveBeenCalledWith('/c/maps/gdrive/gdrive-file-999/edit');
    });
  });
  it('validates required title field before submitting', async () => {
    renderComponent(101);

    const titleInput = await screen.findByDisplayValue('Copy of Original Mindmap');
    fireEvent.change(titleInput, { target: { value: '   ' } });

    const submitButtons = screen.getAllByRole('button', { name: /save as/i });
    const submitButton = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockDuplicateMap).not.toHaveBeenCalled();
      expect(screen.getByText('Title is required')).toBeDefined();
    });
  });
});
