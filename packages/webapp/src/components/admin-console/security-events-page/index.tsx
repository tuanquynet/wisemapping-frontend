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

import React, { ReactElement, useMemo } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import SecurityIcon from '@mui/icons-material/Security';

import AppConfig from '../../../classes/app-config';
import { adminConsoleStyles } from '../styles';
import { SecurityEvent } from '../../../classes/client';

const KNOWN_ACTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'admin_reset_approved', label: 'Admin Reset Approved' },
  { value: 'admin_reset_denied', label: 'Admin Reset Denied' },
  { value: 'enrollment_activated', label: 'Enrollment Activated' },
  { value: 'authenticator_replaced', label: 'Authenticator Replaced' },
  { value: 'recovery_codes_regenerated', label: 'Recovery Codes Regenerated' },
  { value: 'two_factor_disabled', label: '2FA Disabled' },
  { value: 'device_trusted', label: 'Device Trusted' },
  { value: 'device_revoked', label: 'Device Revoked' },
  { value: 'cooldown_triggered', label: 'Cooldown Triggered' },
];

const SecurityEventsPage = (): ReactElement => {
  const intl = useIntl();
  const client = AppConfig.getAdminClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter state from URL query parameters (UX-DR21)
  const accountFilter = searchParams.get('account') || '';
  const actionFilter = searchParams.get('action') || '';
  const fromDateFilter = searchParams.get('fromDate') || '';
  const toDateFilter = searchParams.get('toDate') || '';
  const pageParam = searchParams.get('page');
  const currentPage = pageParam ? Math.max(0, parseInt(pageParam, 10)) : 0;
  const pageSize = 20;

  // Convert date inputs to timestamps
  const fromDateTimestamp = useMemo(() => {
    if (!fromDateFilter) return undefined;
    const parsed = new Date(fromDateFilter).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [fromDateFilter]);

  const toDateTimestamp = useMemo(() => {
    if (!toDateFilter) return undefined;
    // Set to end of day (23:59:59.999)
    const d = new Date(toDateFilter);
    d.setHours(23, 59, 59, 999);
    const parsed = d.getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
  }, [toDateFilter]);

  // Query security events
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      'adminSecurityEvents',
      currentPage,
      pageSize,
      accountFilter,
      actionFilter,
      fromDateTimestamp,
      toDateTimestamp,
    ],
    queryFn: () =>
      client.getAdminSecurityEvents({
        page: currentPage,
        pageSize,
        account: accountFilter || undefined,
        action: actionFilter || undefined,
        fromDate: fromDateTimestamp,
        toDate: toDateTimestamp,
      }),
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    // Reset to page 0 when filters change
    if (key !== 'page') {
      next.delete('page');
    }
    setSearchParams(next);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    updateParam('page', (page - 1).toString());
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(accountFilter || actionFilter || fromDateFilter || toDateFilter);

  const formatEventDate = (timestamp: number) => {
    try {
      return intl.formatDate(new Date(timestamp), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Title and Result Count */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography
            variant="h5"
            component="h1"
            fontWeight={700}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <SecurityIcon color="primary" />
            <FormattedMessage
              id="admin.security-events.title"
              defaultMessage="Security Audit Events"
            />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {data ? (
              <FormattedMessage
                id="admin.security-events.count"
                defaultMessage="{count, plural, =0 {No events found} one {1 event found} other {# events found}}"
                values={{ count: data.totalElements }}
              />
            ) : (
              <FormattedMessage
                id="admin.security-events.subtitle"
                defaultMessage="Review two-step verification security and lifecycle events."
              />
            )}
          </Typography>
        </Box>
        <Tooltip
          title={intl.formatMessage({ id: 'admin.common.refresh', defaultMessage: 'Refresh' })}
        >
          <IconButton onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <FormattedMessage
            id="admin.security-events.load-error"
            defaultMessage="Failed to load security audit events. Please verify you hold the dedicated 2FA reset permission."
          />
        </Alert>
      )}

      {/* Visible Filters Bar (UX-DR21) */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder={intl.formatMessage({
              id: 'admin.security-events.filter-account',
              defaultMessage: 'Search account ID or email...',
            })}
            value={accountFilter}
            onChange={(e) => updateParam('account', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              ...(accountFilter && {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => updateParam('account', '')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }),
            }}
            sx={{ minWidth: 240, flex: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="action-filter-label">
              <FormattedMessage id="admin.security-events.action-label" defaultMessage="Action" />
            </InputLabel>
            <Select
              labelId="action-filter-label"
              value={actionFilter}
              label={intl.formatMessage({
                id: 'admin.security-events.action-label',
                defaultMessage: 'Action',
              })}
              onChange={(e) => updateParam('action', e.target.value)}
            >
              {KNOWN_ACTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label={intl.formatMessage({
              id: 'admin.security-events.from-date',
              defaultMessage: 'From Date',
            })}
            InputLabelProps={{ shrink: true }}
            value={fromDateFilter}
            onChange={(e) => updateParam('fromDate', e.target.value)}
            sx={{ minWidth: 160 }}
          />

          <TextField
            size="small"
            type="date"
            label={intl.formatMessage({
              id: 'admin.security-events.to-date',
              defaultMessage: 'To Date',
            })}
            InputLabelProps={{ shrink: true }}
            value={toDateFilter}
            onChange={(e) => updateParam('toDate', e.target.value)}
            sx={{ minWidth: 160 }}
          />

          {hasActiveFilters && (
            <Button
              variant="text"
              size="small"
              color="inherit"
              onClick={handleClearFilters}
              startIcon={<ClearIcon />}
            >
              <FormattedMessage id="admin.security-events.clear-filters" defaultMessage="Clear" />
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Loading Progress */}
      {isFetching && <LinearProgress sx={{ mb: 1 }} />}

      {/* Events Table (reusing admin table style) */}
      <TableContainer component={Paper} variant="outlined" sx={adminConsoleStyles.tableContainer}>
        <Table sx={{ minWidth: 700 }} size="medium">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>
                <FormattedMessage id="admin.security-events.col.time" defaultMessage="Timestamp" />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <FormattedMessage id="admin.security-events.col.action" defaultMessage="Action" />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <FormattedMessage id="admin.security-events.col.actor" defaultMessage="Actor" />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <FormattedMessage
                  id="admin.security-events.col.affected"
                  defaultMessage="Affected Account"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <FormattedMessage id="admin.security-events.col.outcome" defaultMessage="Outcome" />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <FormattedMessage
                  id="admin.security-events.col.reason"
                  defaultMessage="Reason / Detail"
                />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <FormattedMessage id="admin.common.loading" defaultMessage="Loading..." />
                  </Typography>
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <FormattedMessage
                      id="admin.security-events.empty"
                      defaultMessage="No security events match the selected criteria."
                    />
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((event: SecurityEvent) => (
                <TableRow key={event.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" fontWeight={500}>
                      {formatEventDate(event.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={event.action}
                      size="small"
                      variant="outlined"
                      color={
                        event.action.includes('denied') || event.action.includes('cooldown')
                          ? 'warning'
                          : event.action.includes('reset')
                            ? 'primary'
                            : 'default'
                      }
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{event.actorEmail}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {event.affectedAccountEmail || (
                        <span style={{ color: 'gray' }}>
                          ID: {event.affectedAccountId ?? 'N/A'}
                        </span>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={event.outcome}
                      size="small"
                      color={event.outcome === 'success' ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {event.reason || event.detail || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
      {data && data.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={data.totalPages}
            page={currentPage + 1}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default SecurityEventsPage;
