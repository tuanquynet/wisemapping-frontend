import React, { useContext } from 'react';
import { useNavigate } from 'react-router';
import { useIntl, FormattedMessage } from 'react-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { appLogger as log } from '../../utils/logger';
import { ClientContext } from '../../classes/provider/client-context';
import SecurityStatusRow from './SecurityStatusRow';
import VerifiedActionForm from './VerifiedActionForm';
import type { TwoFactorEnrollment, SecurityEvent } from '../../classes/client';
import DeviceTokenConfig from '../../classes/device-token-config';

const EnrollmentWizard = React.lazy(() => import('./enrollment-wizard'));
/**
 * AccountSecurityPage (/c/account/security)
 *
 * Implements Story 1.4, UX-DR15, UX-DR16, UX-DR17:
 * - Single column layout, max-width 720px.
 * - Fixed panel order: Status -> Authenticator -> Recovery Codes -> Trusted Browsers -> Turn Off.
 * - Neutral "Off" chip state with zero nag banners.
 * - Localized date formatting for activatedAt.
 */
export const AccountSecurityPage: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const client = useContext(ClientContext);
  const queryClient = useQueryClient();
  const [isEnrollmentOpen, setIsEnrollmentOpen] = React.useState<boolean>(false);
  const {
    data: status,
    isLoading,
    error,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['twoFactor', 'status'],
    queryFn: () => client.getTwoFactorStatus(),
  });

  const isEnabled = Boolean(status?.enabled);
  const [revokingDeviceId, setRevokingDeviceId] = React.useState<number | null>(null);
  const [isRevokingAllDevices, setIsRevokingAllDevices] = React.useState<boolean>(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = React.useState<boolean>(false);
  const [isReplacePending, setIsReplacePending] = React.useState<boolean>(false);
  const [replaceError, setReplaceError] = React.useState<string | null>(null);
  const [replacementEnrollment, setReplacementEnrollment] =
    React.useState<TwoFactorEnrollment | null>(null);

  const handleConfirmReplace = async (factorCode: string) => {
    setIsReplacePending(true);
    setReplaceError(null);
    try {
      const enrollmentData = await client.startTwoFactorEnrollment({ code: factorCode });
      setReplacementEnrollment(enrollmentData);
      setIsReplaceModalOpen(false);
      setIsEnrollmentOpen(true);
    } catch (err: unknown) {
      const e = err as { msg?: string; fields?: Map<string, string> };
      const msg =
        (e?.fields instanceof Map ? e.fields.get('code') : undefined) ||
        e?.msg ||
        intl.formatMessage({
          id: 'twofactor.replacement.error-code',
          defaultMessage:
            'Invalid verification code. Please enter a current code from your authenticator app.',
        });
      setReplaceError(msg);
    } finally {
      setIsReplacePending(false);
    }
  };

  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = React.useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = React.useState<boolean>(false);
  const [regenerateError, setRegenerateError] = React.useState<string | null>(null);
  const [newRecoveryCodes, setNewRecoveryCodes] = React.useState<string[]>([]);
  const [isShowNewCodesModalOpen, setIsShowNewCodesModalOpen] = React.useState<boolean>(false);
  const [copiedNewCodes, setCopiedNewCodes] = React.useState<boolean>(false);
  const [regenerateAcknowledged, setRegenerateAcknowledged] = React.useState<boolean>(false);

  const handleConfirmRegenerate = async (factorCode: string) => {
    setIsRegenerating(true);
    setRegenerateError(null);
    try {
      const newCodes = await client.regenerateRecoveryCodes({ code: factorCode });
      setNewRecoveryCodes(newCodes);
      setIsRegenerateModalOpen(false);
      setIsShowNewCodesModalOpen(true);
      setRegenerateAcknowledged(false);
      await refetchStatus();
    } catch (err: unknown) {
      const e = err as { msg?: string; fields?: Map<string, string> };
      const msg =
        (e?.fields instanceof Map ? e.fields.get('code') : undefined) ||
        e?.msg ||
        intl.formatMessage({
          id: 'twofactor.regenerate.error-code',
          defaultMessage:
            'Invalid verification code. Please enter a current code from your authenticator app.',
        });
      setRegenerateError(msg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyNewCodes = async () => {
    if (newRecoveryCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(newRecoveryCodes.join('\n'));
      setCopiedNewCodes(true);
      setTimeout(() => setCopiedNewCodes(false), 2500);
    } catch (e) {
      log.error('Clipboard write failed', e);
    }
  };

  const handleDownloadNewCodes = () => {
    if (newRecoveryCodes.length === 0) return;
    const date = new Date().toISOString().split('T')[0];
    const content = [
      '====================================================================',
      'WiseMapping Two-Step Verification Recovery Codes',
      '====================================================================',
      `Generated: ${date}`,
      '',
      'Each recovery code can be used ONCE to sign into your account if you',
      'lose access to your authenticator app.',
      '',
      'Keep these codes in a secure, offline location (such as a password manager',
      'or a physical safe). Never share them with anyone.',
      '',
      'Recovery Codes:',
      ...newRecoveryCodes.map((c, i) => `  ${String(i + 1).padStart(2, ' ')}. ${c}`),
      '',
      '====================================================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wisemapping-recovery-codes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrintNewCodes = () => {
    window.print();
  };

  const [isDisableModalOpen, setIsDisableModalOpen] = React.useState<boolean>(false);
  const [isDisabling, setIsDisabling] = React.useState<boolean>(false);
  const [disableError, setDisableError] = React.useState<string | null>(null);

  const handleConfirmDisable = async (factorCode: string) => {
    setIsDisabling(true);
    setDisableError(null);
    try {
      await client.disableTwoFactor({ code: factorCode });
      DeviceTokenConfig.removeToken();
      setIsDisableModalOpen(false);
      await Promise.all([refetchStatus(), refetchDevices()]);
    } catch (err: unknown) {
      const e = err as { msg?: string; fields?: Map<string, string> };
      const msg =
        (e?.fields instanceof Map ? e.fields.get('code') : undefined) ||
        e?.msg ||
        intl.formatMessage({
          id: 'twofactor.disable.error-code',
          defaultMessage:
            'Invalid verification code. Please enter a current code from your authenticator app.',
        });
      setDisableError(msg);
    } finally {
      setIsDisabling(false);
    }
  };
  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ['trustedDevices'],
    queryFn: () => client.fetchTrustedDevices(),
    enabled: isEnabled,
  });

  const reenrollRequired = Boolean(status?.reenrollRequired);
  const { data: securityEvents = [] } = useQuery<SecurityEvent[]>({
    queryKey: ['securityEvents'],
    queryFn: () => client.fetchSecurityEvents(),
    enabled: reenrollRequired,
  });
  // Find the most recent admin_reset_approved event for the banner.
  const reenrollEvent = reenrollRequired
    ? (securityEvents.find((e) => e.action === 'admin_reset_approved') ?? null)
    : null;

  const handleRevokeDevice = async (id: number) => {
    setRevokingDeviceId(id);
    try {
      await client.revokeTrustedDevice(id);
      await refetchDevices();
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const handleRevokeAllDevices = async () => {
    setIsRevokingAllDevices(true);
    try {
      await client.revokeAllTrustedDevices();
      await refetchDevices();
    } finally {
      setIsRevokingAllDevices(false);
    }
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default', py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        {/* Navigation / Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <IconButton
            onClick={() => navigate('/c/maps/')}
            aria-label={intl.formatMessage({
              id: 'twofactor.back-to-maps',
              defaultMessage: 'Back to maps',
            })}
            size="large"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" fontWeight={700}>
              <FormattedMessage id="twofactor.page.title" defaultMessage="Account Security" />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <FormattedMessage
                id="twofactor.page.subtitle"
                defaultMessage="Manage your two-step verification and trusted devices."
              />
            </Typography>
          </Box>
        </Stack>

        {/* Post-admin-reset restricted state notice (FR34, D14, AR33) */}
        {reenrollRequired && (
          <Alert
            severity="warning"
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={() => setIsEnrollmentOpen(true)}
              >
                <FormattedMessage
                  id="twofactor.reenroll.cta"
                  defaultMessage="Set up two-step verification"
                />
              </Button>
            }
          >
            <AlertTitle>
              <FormattedMessage
                id="twofactor.reenroll.title"
                defaultMessage="Your two-step verification was reset by an administrator"
              />
            </AlertTitle>
            {reenrollEvent ? (
              <FormattedMessage
                id="twofactor.reenroll.detail-with-actor"
                defaultMessage="Reset by {actor} on {date}{reason}. Set up two-step verification again to restore full access to your account. If you did not request this, contact your administrator."
                values={{
                  actor: <strong>{reenrollEvent.actorEmail}</strong>,
                  date: <strong>{new Date(reenrollEvent.createdAt).toLocaleDateString()}</strong>,
                  reason: reenrollEvent.reason ? (
                    <span>
                      {' '}
                      &mdash; reason: <em>{reenrollEvent.reason}</em>
                    </span>
                  ) : (
                    ''
                  ),
                }}
              />
            ) : (
              <FormattedMessage
                id="twofactor.reenroll.detail-generic"
                defaultMessage="Your two-step verification has been reset. Set up two-step verification again to restore full access to your account. If you did not request this, contact your administrator."
              />
            )}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <FormattedMessage
              id="twofactor.load-error"
              defaultMessage="Unable to load two-step verification status. Please try again."
            />
          </Alert>
        )}

        {!isLoading && !error && status && (
          <Stack spacing={2.5}>
            {/* Panel 1: Status Panel */}
            <Card variant="outlined">
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <SecurityStatusRow
                  title={
                    <FormattedMessage
                      id="twofactor.status.title"
                      defaultMessage="Two-step verification"
                    />
                  }
                  description={
                    isEnabled && typeof status?.activatedAt === 'number' ? (
                      <FormattedMessage
                        id="twofactor.status.enabled-date"
                        defaultMessage="Enabled on {date}"
                        values={{
                          date: intl.formatDate(new Date(status.activatedAt), {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }),
                        }}
                      />
                    ) : (
                      <FormattedMessage
                        id="twofactor.status.disabled-description"
                        defaultMessage="Protect your account by requiring an authenticator code when signing in."
                      />
                    )
                  }
                  status={
                    isEnabled ? (
                      <Chip
                        label={intl.formatMessage({
                          id: 'twofactor.status.on',
                          defaultMessage: 'On',
                        })}
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        label={intl.formatMessage({
                          id: 'twofactor.status.off',
                          defaultMessage: 'Off',
                        })}
                        variant="outlined"
                        size="small"
                      />
                    )
                  }
                  action={
                    !isEnabled ? (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setIsEnrollmentOpen(true)}
                        sx={{ minHeight: 40 }}
                      >
                        <FormattedMessage id="twofactor.action.turn-on" defaultMessage="Turn on" />
                      </Button>
                    ) : null
                  }
                />
              </CardContent>
            </Card>

            {/* Panel 2: Authenticator App Panel */}
            <Card variant="outlined">
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <SecurityStatusRow
                  title={
                    <FormattedMessage
                      id="twofactor.authenticator.title"
                      defaultMessage="Authenticator app"
                    />
                  }
                  description={
                    isEnabled ? (
                      <FormattedMessage
                        id="twofactor.authenticator.configured-desc"
                        defaultMessage="Use an app like Google Authenticator or 1Password to get verification codes."
                      />
                    ) : (
                      <FormattedMessage
                        id="twofactor.authenticator.unconfigured-desc"
                        defaultMessage="No authenticator app registered."
                      />
                    )
                  }
                  status={
                    <Chip
                      label={
                        isEnabled
                          ? intl.formatMessage({
                              id: 'twofactor.authenticator.registered',
                              defaultMessage: 'Registered',
                            })
                          : intl.formatMessage({
                              id: 'twofactor.authenticator.not-registered',
                              defaultMessage: 'Not registered',
                            })
                      }
                      variant="outlined"
                      size="small"
                    />
                  }
                  action={
                    isEnabled ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setReplaceError(null);
                          setIsReplaceModalOpen(true);
                        }}
                        sx={{ minHeight: 40 }}
                      >
                        <FormattedMessage id="twofactor.action.replace" defaultMessage="Replace" />
                      </Button>
                    ) : null
                  }
                />
              </CardContent>
            </Card>

            {/* Panel 3: Recovery Codes Panel */}
            <Card variant="outlined">
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <SecurityStatusRow
                  title={
                    <FormattedMessage
                      id="twofactor.recovery-codes.title"
                      defaultMessage="Recovery codes"
                    />
                  }
                  description={
                    isEnabled ? (
                      <FormattedMessage
                        id="twofactor.recovery-codes.remaining"
                        defaultMessage="{remaining} of 10 unused"
                        values={{ remaining: status?.recoveryCodesRemaining ?? 0 }}
                      />
                    ) : (
                      <FormattedMessage
                        id="twofactor.recovery-codes.unconfigured"
                        defaultMessage="Recovery codes will be generated when you turn on two-step verification."
                      />
                    )
                  }
                  action={
                    isEnabled ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setRegenerateError(null);
                          setIsRegenerateModalOpen(true);
                        }}
                        sx={{ minHeight: 40 }}
                      >
                        <FormattedMessage
                          id="twofactor.action.generate-codes"
                          defaultMessage="Generate new codes"
                        />
                      </Button>
                    ) : null
                  }
                />
                {isEnabled && status?.recoveryCodesRemaining === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }} role="alert">
                    <FormattedMessage
                      id="twofactor.recovery-codes.zero-warning"
                      defaultMessage="You have 0 recovery codes remaining. Generate new codes to ensure you can access your account if your authenticator is lost."
                    />
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Panel 4: Trusted Browsers Panel (FR17, FR18, FR19, UX-DR2, UX-DR18) */}
            <Card variant="outlined">
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <SecurityStatusRow
                  title={
                    <FormattedMessage
                      id="twofactor.trusted-devices.title"
                      defaultMessage="Remembered browsers"
                    />
                  }
                  description={
                    isEnabled ? (
                      <FormattedMessage
                        id="twofactor.trusted-devices.desc"
                        defaultMessage="Trust lasts 30 days and does not renew automatically."
                      />
                    ) : (
                      <FormattedMessage
                        id="twofactor.trusted-devices.desc-disabled"
                        defaultMessage="Browsers you trust will not ask for a code on sign-in for 30 days."
                      />
                    )
                  }
                  action={
                    isEnabled && devices.length > 0 ? (
                      <Button
                        variant="outlined"
                        color="inherit"
                        size="small"
                        onClick={handleRevokeAllDevices}
                        disabled={isRevokingAllDevices}
                        sx={{ minHeight: 40, minWidth: 44 }}
                      >
                        <FormattedMessage
                          id="twofactor.action.revoke-all-devices"
                          defaultMessage="Revoke all"
                        />
                      </Button>
                    ) : null
                  }
                />
                {isEnabled && devices.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    <FormattedMessage
                      id="twofactor.trusted-devices.empty"
                      defaultMessage="No browsers are remembered. You'll enter a code each time you sign in."
                    />
                  </Typography>
                )}
                {isEnabled && devices.length > 0 && (
                  <Stack spacing={0} sx={{ mt: 2 }}>
                    {devices.map((device) => (
                      <Box
                        key={device.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          py: 1.5,
                          borderTop: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {device.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <FormattedMessage
                              id="twofactor.trusted-devices.dates"
                              defaultMessage="Added {addedDate} • Expires {expiresDate}"
                              values={{
                                addedDate: intl.formatDate(device.createdAt, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                }),
                                expiresDate: intl.formatDate(device.expiresAt, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                }),
                              }}
                            />
                          </Typography>
                        </Box>
                        <Button
                          variant="text"
                          color="error"
                          size="small"
                          onClick={() => handleRevokeDevice(device.id)}
                          disabled={revokingDeviceId === device.id || isRevokingAllDevices}
                          aria-label={intl.formatMessage(
                            {
                              id: 'twofactor.action.revoke-device-aria',
                              defaultMessage: 'Revoke trust for {label}',
                            },
                            { label: device.label },
                          )}
                          sx={{ minHeight: 44, minWidth: 44, px: 2 }}
                        >
                          <FormattedMessage
                            id="twofactor.action.revoke-device"
                            defaultMessage="Revoke"
                          />
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Panel 5: Turn Off Panel */}
            {isEnabled && (
              <Card variant="outlined" sx={{ borderColor: 'error.light' }}>
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <SecurityStatusRow
                    title={
                      <FormattedMessage
                        id="twofactor.turn-off.title"
                        defaultMessage="Turn off two-step verification"
                      />
                    }
                    description={
                      <FormattedMessage
                        id="twofactor.turn-off.desc"
                        defaultMessage="Removes authenticator protection and revokes all remembered browsers."
                      />
                    }
                    action={
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => {
                          setDisableError(null);
                          setIsDisableModalOpen(true);
                        }}
                        sx={{ minHeight: 40 }}
                      >
                        <FormattedMessage
                          id="twofactor.action.turn-off"
                          defaultMessage="Turn off"
                        />
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        <Dialog
          open={isReplaceModalOpen}
          onClose={() => !isReplacePending && setIsReplaceModalOpen(false)}
          maxWidth="sm"
          fullWidth
          aria-labelledby="replace-dialog-title"
        >
          <DialogTitle id="replace-dialog-title">
            <Typography variant="h6" component="h2" fontWeight={600}>
              <FormattedMessage
                id="twofactor.replacement.dialog-title"
                defaultMessage="Replace authenticator app"
              />
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            <VerifiedActionForm
              consequence={
                <FormattedMessage
                  id="twofactor.replacement.consequence"
                  defaultMessage="Replacing your authenticator will invalidate your existing authenticator. Your existing recovery codes and remembered browsers will remain active."
                />
              }
              variant="code"
              confirmLabel={
                <FormattedMessage id="twofactor.action.continue" defaultMessage="Continue" />
              }
              isPending={isReplacePending}
              error={replaceError}
              onConfirm={handleConfirmReplace}
              onCancel={() => setIsReplaceModalOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog for Regenerate Confirmation (VerifiedActionForm) */}
        <Dialog
          open={isRegenerateModalOpen}
          onClose={() => !isRegenerating && setIsRegenerateModalOpen(false)}
          maxWidth="sm"
          fullWidth
          aria-labelledby="regenerate-dialog-title"
        >
          <DialogTitle id="regenerate-dialog-title">
            <Typography variant="h6" component="h2" fontWeight={600}>
              <FormattedMessage
                id="twofactor.recovery.dialog-title"
                defaultMessage="Generate new recovery codes"
              />
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            <VerifiedActionForm
              consequence={
                <FormattedMessage
                  id="twofactor.recovery.consequence"
                  defaultMessage="Generating new recovery codes will immediately invalidate all existing recovery codes, both used and unused."
                />
              }
              variant="code"
              confirmLabel={
                <FormattedMessage
                  id="twofactor.action.generate-codes"
                  defaultMessage="Generate new codes"
                />
              }
              confirmColor="primary"
              isPending={isRegenerating}
              error={regenerateError}
              onConfirm={handleConfirmRegenerate}
              onCancel={() => setIsRegenerateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog for Displaying New Recovery Codes (UX-DR12) */}
        <Dialog
          open={isShowNewCodesModalOpen}
          onClose={() => {}}
          maxWidth="sm"
          fullWidth
          disableEscapeKeyDown={true}
          aria-labelledby="new-codes-dialog-title"
        >
          <DialogTitle id="new-codes-dialog-title">
            <Typography variant="h6" component="h2" fontWeight={600}>
              <FormattedMessage
                id="twofactor.recovery.new-codes-title"
                defaultMessage="New recovery codes generated"
              />
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Alert severity="success" role="alert">
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  <FormattedMessage
                    id="twofactor.recovery.success-title"
                    defaultMessage="Recovery codes regenerated"
                  />
                </Typography>
                <Typography variant="body2">
                  <FormattedMessage
                    id="twofactor.recovery.success-desc"
                    defaultMessage="Your previous recovery codes no longer work. Save these 10 new codes in a safe place."
                  />
                </Typography>
              </Alert>

              <Box
                component="ol"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  p: 2,
                  m: 0,
                  listStyle: 'none',
                }}
              >
                {newRecoveryCodes.map((c, index) => (
                  <Box
                    component="li"
                    key={c}
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      letterSpacing: 1.5,
                      py: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ mr: 1, display: 'inline-block', width: 20 }}
                    >
                      {index + 1}.
                    </Typography>
                    <code>{c}</code>
                  </Box>
                ))}
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                <Button
                  onClick={handleCopyNewCodes}
                  variant="outlined"
                  sx={{ minHeight: 44, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
                >
                  <FormattedMessage
                    id="twofactor.enrollment.copy-codes-short"
                    defaultMessage="Copy codes"
                  />
                </Button>
                <Button
                  onClick={handleDownloadNewCodes}
                  variant="outlined"
                  sx={{ minHeight: 44, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
                >
                  <FormattedMessage
                    id="twofactor.enrollment.download-codes"
                    defaultMessage="Download (.txt)"
                  />
                </Button>
                <Button
                  onClick={handlePrintNewCodes}
                  variant="outlined"
                  sx={{ minHeight: 44, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
                >
                  <FormattedMessage id="twofactor.enrollment.print-codes" defaultMessage="Print" />
                </Button>
                <Typography
                  variant="body2"
                  color="success.main"
                  aria-live="polite"
                  role="status"
                  sx={{ visibility: copiedNewCodes ? 'visible' : 'hidden', ml: 1 }}
                >
                  <FormattedMessage
                    id="twofactor.enrollment.codes-copied"
                    defaultMessage="Recovery codes copied to clipboard"
                  />
                </Typography>
              </Stack>

              {/* UX-DR12: Explicit acknowledgement gate */}
              <Box sx={{ pt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={regenerateAcknowledged}
                      onChange={(e) => setRegenerateAcknowledged(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      <FormattedMessage
                        id="twofactor.enrollment.saved-acknowledgement"
                        defaultMessage="I've saved these recovery codes in a safe place"
                      />
                    </Typography>
                  }
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => {
                setIsShowNewCodesModalOpen(false);
                setNewRecoveryCodes([]);
              }}
              variant="contained"
              disabled={!regenerateAcknowledged}
              sx={{ minHeight: 44, minWidth: 100 }}
            >
              <FormattedMessage id="twofactor.enrollment.done" defaultMessage="Done" />
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog for Turn Off Confirmation (VerifiedActionForm) */}
        <Dialog
          open={isDisableModalOpen}
          onClose={() => !isDisabling && setIsDisableModalOpen(false)}
          maxWidth="sm"
          fullWidth
          aria-labelledby="disable-dialog-title"
        >
          <DialogTitle id="disable-dialog-title">
            <Typography variant="h6" component="h2" fontWeight={600}>
              <FormattedMessage
                id="twofactor.disable.dialog-title"
                defaultMessage="Turn off two-step verification"
              />
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            <VerifiedActionForm
              consequence={
                <FormattedMessage
                  id="twofactor.disable.consequence"
                  defaultMessage="Turning off two-step verification removes authenticator protection, invalidates all recovery codes, and revokes all remembered browsers."
                />
              }
              consequenceSeverity="error"
              variant="code"
              confirmLabel={
                <FormattedMessage id="twofactor.action.turn-off" defaultMessage="Turn off" />
              }
              confirmColor="error"
              isPending={isDisabling}
              error={disableError}
              onConfirm={handleConfirmDisable}
              onCancel={() => setIsDisableModalOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {isEnrollmentOpen && (
          <React.Suspense fallback={null}>
            <EnrollmentWizard
              onClose={() => {
                setIsEnrollmentOpen(false);
                setReplacementEnrollment(null);
                // Refetch status so reenrollRequired banner clears on success (FR33, D14).
                void refetchStatus();
                void queryClient.invalidateQueries({ queryKey: ['securityEvents'] });
              }}
              isReplacement={Boolean(replacementEnrollment)}
              initialEnrollment={replacementEnrollment}
            />
          </React.Suspense>
        )}
      </Box>
    </Box>
  );
};

export default AccountSecurityPage;
