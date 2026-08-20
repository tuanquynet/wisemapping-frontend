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

import React, { useContext, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation } from '@tanstack/react-query';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

import { BasicMapInfo, ErrorInfo } from '../../../../classes/client';

export const redirectTo = (url: string): void => {
  window.location.href = url;
};
import Input from '../../../form/input';
import { SimpleDialogProps } from '..';
import BaseDialog from '../base-dialog';
import { useFetchMapById } from '../../../../classes/middleware';
import { ClientContext } from '../../../../classes/provider/client-context';
import { exportMindmapToGoogleDrive } from '../export-dialog/GoogleDriveExportHandler';
import { fetchMindmap } from '../../../editor-page/PersistenceManagerUtils';
import { Mindmap, TextExporterFactory } from '@wisemapping/editor';
import AppConfig from '../../../../classes/app-config';
import JwtTokenConfig from '../../../../classes/jwt-token-config';

export type DestinationType = 'internal' | 'gdrive';

export type SaveAsModel = {
  id: number;
  title: string;
  description?: string;
  destination: DestinationType;
};

const defaultModel: SaveAsModel = {
  id: -1,
  title: '',
  description: '',
  destination: 'internal',
};

const SaveAsDialog = ({ mapId, onClose }: SimpleDialogProps): React.ReactElement => {
  const client = useContext(ClientContext);
  const [model, setModel] = useState<SaveAsModel>(defaultModel);
  const [error, setError] = useState<ErrorInfo>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const intl = useIntl();

  const internalMutation = useMutation<number, ErrorInfo, SaveAsModel>({
    mutationFn: (saveModel: SaveAsModel) => {
      const { id, title, description } = saveModel;
      const basicInfo: BasicMapInfo = {
        title,
        description,
      };
      return client.duplicateMap(id, basicInfo);
    },
    onSuccess: (newMapId) => {
      redirectTo(`/c/maps/${newMapId}/edit`);
    },
    onError: (err) => {
      setError(err);
    },
  });

  const handleOnClose = (): void => {
    onClose();
  };

  const handleOnSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    // Validate that title is not empty or just whitespace
    const trimmedTitle = model.title?.trim();
    if (!trimmedTitle || trimmedTitle.length === 0) {
      setError({
        fields: new Map([
          [
            'title',
            intl.formatMessage({
              id: 'validation.title-required',
              defaultMessage: 'Title is required',
            }),
          ],
        ]),
      });
      return;
    }

    if (model.destination === 'internal') {
      if (mapId != null && !Number.isNaN(mapId) && mapId > 0) {
        const validatedModel: SaveAsModel = {
          id: mapId,
          title: trimmedTitle,
          description: model.description,
          destination: 'internal',
        };
        internalMutation.mutate(validatedModel);
      } else {
        // Saving a non-database map (e.g. from Google Drive or editor) to internal server
        setIsLoading(true);
        try {
          let mindmap: Mindmap;
          if (globalThis.designer) {
            mindmap = globalThis.designer.getMindmap();
          } else {
            mindmap = await fetchMindmap(mapId);
          }

          const exporter = TextExporterFactory.create('wxml', mindmap);
          const xmlContent = await exporter.export();

          const newMapId = await client.createMap({
            title: trimmedTitle,
            description: model.description,
          });

          if (AppConfig.isRestClient()) {
            const token = JwtTokenConfig.retreiveToken();
            const baseUrl = AppConfig.getApiBaseUrl();
            const headers: Record<string, string> = {
              'Content-Type': 'text/plain',
            };
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }
            await fetch(`${baseUrl}/api/restful/maps/${newMapId}/document/xml`, {
              method: 'PUT',
              headers,
              body: xmlContent,
            });
          }

          redirectTo(`/c/maps/${newMapId}/edit`);
        } catch (err: unknown) {
          const errorMsg =
            err instanceof Error
              ? err.message
              : intl.formatMessage({
                  id: 'error.internal-save-failed',
                  defaultMessage: 'Failed to save map to server',
                });
          setError({ msg: errorMsg });
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      // Google Drive Destination
      setIsLoading(true);
      try {
        let mindmap: Mindmap;
        if (globalThis.designer) {
          mindmap = globalThis.designer.getMindmap();
        } else {
          mindmap = await fetchMindmap(mapId);
        }

        const exporter = TextExporterFactory.create('wxml', mindmap);
        const xmlContent = await exporter.export();

        const file = await exportMindmapToGoogleDrive(trimmedTitle, xmlContent);

        try {
          await client.createMap({
            title: trimmedTitle,
            sourceType: 'gdrive',
            sourceId: file.id,
          });
        } catch (linkError) {
          console.warn('Failed to link Google Drive map in database', linkError);
        }

        redirectTo(`/c/maps/gdrive/${file.id}/edit`);
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : intl.formatMessage({
                id: 'error.gdrive-save-failed',
                defaultMessage: 'Failed to save to Google Drive',
              });
        setError({ msg: errorMsg });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const name = event.target.name;
    const value = event.target.value;

    if (error) {
      setError(undefined);
    }

    if (name === 'title') {
      setModel((prev) => ({ ...prev, title: value }));
    } else if (name === 'description') {
      setModel((prev) => ({ ...prev, description: value }));
    } else if (name === 'destination') {
      setModel((prev) => ({ ...prev, destination: value as DestinationType }));
    }
  };

  const { data: map } = useFetchMapById(mapId);
  const mapTitle = map?.title;
  const mapDesc = map?.description;

  useEffect(() => {
    if (mapTitle) {
      const copyPrefix = intl.formatMessage({
        id: 'save-as.copy-prefix',
        defaultMessage: 'Copy of ',
      });
      const copyTitle = `${copyPrefix}${mapTitle.trim()}`;

      setModel((prev) => {
        if (prev.title === copyTitle && prev.description === (mapDesc ?? '')) {
          return prev;
        }
        return {
          ...prev,
          title: copyTitle,
          description: mapDesc ?? '',
          id: mapId,
        };
      });
    } else if (globalThis.designer) {
      try {
        const mindmap = globalThis.designer.getMindmap();
        const centralTopic = mindmap?.getCentralTopic();
        const baseTitle = centralTopic?.getText() || 'Mindmap';
        const copyPrefix = intl.formatMessage({
          id: 'save-as.copy-prefix',
          defaultMessage: 'Copy of ',
        });
        const copyTitle = `${copyPrefix}${baseTitle}`;
        setModel((prev) => {
          if (prev.title) return prev;
          return {
            ...prev,
            title: copyTitle,
            id: mapId,
          };
        });
      } catch {
        // ignore
      }
    }
  }, [mapTitle, mapDesc, mapId]);

  return (
    <div>
      <BaseDialog
        onClose={handleOnClose}
        onSubmit={handleOnSubmit}
        error={error}
        isLoading={internalMutation.isPending || isLoading}
        title={intl.formatMessage({ id: 'save-as.title', defaultMessage: 'Save As' })}
        submitButton={intl.formatMessage({ id: 'save-as.title', defaultMessage: 'Save As' })}
      >
        <FormControl fullWidth margin="dense">
          <FormLabel id="save-as-destination-label" sx={{ mb: 1, fontWeight: 'bold' }}>
            <FormattedMessage id="save-as.destination" defaultMessage="Save to" />
          </FormLabel>
          <RadioGroup
            row
            aria-labelledby="save-as-destination-label"
            name="destination"
            value={model.destination}
            onChange={handleOnChange}
          >
            <FormControlLabel
              value="internal"
              control={<Radio />}
              label={
                <FormattedMessage
                  id="save-as.destination-internal"
                  defaultMessage="WiseMapping Server"
                />
              }
            />
            <FormControlLabel
              value="gdrive"
              control={<Radio />}
              label={
                <FormattedMessage id="save-as.destination-gdrive" defaultMessage="Google Drive" />
              }
            />
          </RadioGroup>
        </FormControl>

        {model.destination === 'gdrive' && (
          <Box sx={{ my: 1.5 }}>
            <Alert severity="info">
              <FormattedMessage
                id="save-as.gdrive-info"
                defaultMessage="The mindmap will be saved as a .wxml file to your Google Drive account."
              />
            </Alert>
          </Box>
        )}

        <FormControl fullWidth margin="dense">
          <Input
            name="title"
            type="text"
            label={intl.formatMessage({
              id: 'form.name',
              defaultMessage: 'Title',
            })}
            required={true}
            value={model.title}
            onChange={handleOnChange}
            error={error}
          />
        </FormControl>

        {model.destination === 'internal' && (
          <FormControl fullWidth margin="dense">
            <Input
              name="description"
              type="text"
              label={intl.formatMessage({
                id: 'form.description',
                defaultMessage: 'Description',
              })}
              required={false}
              rows={4}
              value={model.description ?? ''}
              onChange={handleOnChange}
              error={error}
            />
          </FormControl>
        )}
      </BaseDialog>
    </div>
  );
};

export default SaveAsDialog;
