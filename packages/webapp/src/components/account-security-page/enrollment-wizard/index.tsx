import React, { useContext, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { QRCodeSVG } from 'qrcode.react';
import {
  ErrorInfo,
  TwoFactorEnrollment,
  TwoFactorActivationResult,
  AuthenticationType,
} from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { useFetchAccount } from '../../../classes/middleware';
import { appLogger as log } from '../../../utils/logger';

type EnrollmentWizardProps = {
  onClose: () => void;
  isReplacement?: boolean;
  initialEnrollment?: TwoFactorEnrollment | null;
};

type WizardStep = 'password' | 'scan' | 'verify' | 'recovery';

/**
 * EnrollmentWizard (Stories 1.5, 1.6, 1.7)
 *
 * Implements:
 * - Step 1: Reconfirmation (Password for password users; token freshness for OAuth users - D10)
 * - Step 2: Register app (inline SVG QR code + peer setup key - UX-DR11, UX-DR1)
 * - Step 3: Verify code (single numeric input, whitespace stripped, focus retained on error - FR5, UX-DR4, UX-DR9, UX-DR10)
 * - Step 4: Save recovery codes (10 single-use codes - FR7, UX-DR1, UX-DR12)
 * - Non-interactive step indicator (MUI Stepper rejected per UX-DR13)
 */
const EnrollmentWizard = ({
  onClose,
  isReplacement = false,
  initialEnrollment = null,
}: EnrollmentWizardProps): React.ReactElement => {
  const client = useContext(ClientContext);
  const queryClient = useQueryClient();
  const account = useFetchAccount();
  const intl = useIntl();

  const codeInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>(
    isReplacement && initialEnrollment ? 'scan' : 'password',
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(initialEnrollment);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<ErrorInfo>();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [savedAcknowledged, setSavedAcknowledged] = useState(false);

  const isOAuthAccount =
    account?.authenticationType === AuthenticationType.GOOGLE_OAUTH2 ||
    account?.authenticationType === AuthenticationType.FACEBOOK_OAUTH2;

  const startMutation = useMutation<TwoFactorEnrollment, ErrorInfo, void>({
    mutationFn: () => client.startTwoFactorEnrollment(isOAuthAccount ? undefined : password),
    onSuccess: (data) => {
      setError(undefined);
      setEnrollment(data);
      setCurrentStep('scan');
    },
    onError: (e) => setError(e),
  });

  const activateMutation = useMutation<TwoFactorActivationResult, ErrorInfo, string>({
    mutationFn: (totpCode: string) => client.activateTwoFactorEnrollment(totpCode),
    onSuccess: async (data) => {
      setError(undefined);
      setRecoveryCodes(data.recoveryCodes);
      setCurrentStep('recovery');
      // Invalidate status so security page immediately reflects active protection (FR5)
      await queryClient.invalidateQueries({ queryKey: ['twoFactor', 'status'] });
    },
    onError: (e) => {
      setError(e);
      // UX-DR10: Preserve input and return focus to the code field
      setTimeout(() => {
        codeInputRef.current?.focus();
        codeInputRef.current?.select();
      }, 50);
    },
  });

  const abandonMutation = useMutation<void, ErrorInfo, void>({
    mutationFn: () => client.abandonTwoFactorEnrollment(),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['twoFactor', 'status'] });
    },
  });

  const handleCancel = () => {
    // Abandon pending setup if we have not activated yet
    if (currentStep !== 'recovery' && enrollment !== null) {
      abandonMutation.mutate();
    }
    onClose();
  };

  const handleCopySetupKey = async () => {
    if (enrollment === null) return;
    try {
      await navigator.clipboard.writeText(enrollment.setupKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch (e) {
      log.error('Clipboard write failed', e);
    }
  };

  const handleCopyRecoveryCodes = async () => {
    if (recoveryCodes.length === 0) return;
    try {
      const formatted = recoveryCodes
        .map((c, i) => `${String(i + 1).padStart(2, ' ')}. ${c}`)
        .join('\n');
      await navigator.clipboard.writeText(formatted);
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2500);
    } catch (e) {
      log.error('Clipboard write failed', e);
    }
  };

  const handleDownloadRecoveryCodes = () => {
    if (recoveryCodes.length === 0) return;
    const email = account?.email || 'user';
    const date = new Date().toISOString().split('T')[0];
    const content = [
      '====================================================================',
      'WiseMapping Two-Step Verification Recovery Codes',
      '====================================================================',
      `Account: ${email}`,
      `Generated: ${date}`,
      '',
      'Each recovery code can be used ONCE to sign into your account if you',
      'lose access to your authenticator app.',
      '',
      'Keep these codes in a secure, offline location (such as a password manager',
      'or a physical safe). Never share them with anyone.',
      '',
      'Recovery Codes:',
      ...recoveryCodes.map((c, i) => `  ${String(i + 1).padStart(2, ' ')}. ${c}`),
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

  const handlePrintRecoveryCodes = () => {
    window.print();
  };
  const canSubmitPassword = isOAuthAccount ? true : password.trim().length > 0;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPassword || startMutation.isPending) return;
    startMutation.mutate();
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.replace(/\s+/g, '');
    if (cleanCode.length !== 6 || activateMutation.isPending) return;
    activateMutation.mutate(cleanCode);
  };

  // Resolve field error message from ErrorInfo
  const codeErrorMessage =
    (error?.fields instanceof Map
      ? error.fields.get('code')
      : (error?.fields as unknown as Record<string, string>)?.['code']) || error?.msg;

  return (
    <Dialog
      open={true}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="enrollment-wizard-title"
      disableEscapeKeyDown={currentStep === 'recovery'}
    >
      <DialogTitle id="enrollment-wizard-title" sx={{ pb: 1 }}>
        <Typography variant="h6" component="h2" fontWeight={600}>
          {isReplacement ? (
            <FormattedMessage
              id="twofactor.replacement.modal-title"
              defaultMessage="Replace authenticator app"
            />
          ) : (
            <FormattedMessage
              id="twofactor.enrollment.modal-title"
              defaultMessage="Set up two-step verification"
            />
          )}
        </Typography>
      </DialogTitle>

      {/* Non-interactive step indicator (UX-DR13) */}
      {isReplacement ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ px: 3, pb: 2 }}
          aria-label={intl.formatMessage({
            id: 'twofactor.replacement.progress',
            defaultMessage: 'Replacement progress',
          })}
        >
          <Typography
            variant="caption"
            color={currentStep === 'scan' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'scan' ? 700 : 400}
          >
            1. Register new app
          </Typography>
          <Typography variant="caption" color="text.disabled">
            ·
          </Typography>
          <Typography
            variant="caption"
            color={currentStep === 'verify' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'verify' ? 700 : 400}
          >
            2. Verify code
          </Typography>
          <Typography variant="caption" color="text.disabled">
            ·
          </Typography>
          <Typography
            variant="caption"
            color={currentStep === 'recovery' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'recovery' ? 700 : 400}
          >
            3. Done
          </Typography>
        </Stack>
      ) : (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ px: 3, pb: 2 }}
          aria-label={intl.formatMessage({
            id: 'twofactor.enrollment.progress',
            defaultMessage: 'Enrollment progress',
          })}
        >
          <Typography
            variant="caption"
            color={currentStep === 'password' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'password' ? 700 : 400}
          >
            1. Confirm
          </Typography>
          <Typography variant="caption" color="text.disabled">
            ·
          </Typography>
          <Typography
            variant="caption"
            color={currentStep === 'scan' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'scan' ? 700 : 400}
          >
            2. Register app
          </Typography>
          <Typography variant="caption" color="text.disabled">
            ·
          </Typography>
          <Typography
            variant="caption"
            color={currentStep === 'verify' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'verify' ? 700 : 400}
          >
            3. Verify code
          </Typography>
          <Typography variant="caption" color="text.disabled">
            ·
          </Typography>
          <Typography
            variant="caption"
            color={currentStep === 'recovery' ? 'primary.main' : 'text.secondary'}
            fontWeight={currentStep === 'recovery' ? 700 : 400}
          >
            4. Recovery codes
          </Typography>
        </Stack>
      )}

      {/* Step 1: Confirm Password */}
      {currentStep === 'password' && (
        <form onSubmit={handlePasswordSubmit} noValidate>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && (
                <Alert severity="error" role="alert">
                  {error.msg || (
                    <FormattedMessage
                      id="twofactor.enrollment.generic-error"
                      defaultMessage="Failed to start enrollment. Please try again."
                    />
                  )}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                <FormattedMessage
                  id="twofactor.enrollment.intro"
                  defaultMessage="You will scan a QR code with your authenticator app (for example Google Authenticator or 1Password) and enter a 6-digit code to confirm it works before anything changes."
                />
              </Typography>
              {isOAuthAccount ? (
                <Alert severity="info">
                  <FormattedMessage
                    id="twofactor.enrollment.oauth-hint"
                    defaultMessage="Your account signs in with Google, so we will confirm this action with your recent sign-in instead of a password."
                  />
                </Alert>
              ) : (
                <TextField
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  label={intl.formatMessage({
                    id: 'twofactor.enrollment.password-label',
                    defaultMessage: 'Confirm your password',
                  })}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={startMutation.isPending}
                  required
                  fullWidth
                  margin="dense"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={intl.formatMessage({
                              id: 'twofactor.enrollment.toggle-password',
                              defaultMessage: 'Toggle password visibility',
                            })}
                            size="large"
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={handleCancel}
              color="inherit"
              disabled={startMutation.isPending}
              sx={{ minHeight: 44 }}
            >
              <FormattedMessage id="twofactor.enrollment.cancel" defaultMessage="Cancel" />
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canSubmitPassword || startMutation.isPending}
              sx={{ minHeight: 44, minWidth: 100 }}
            >
              {startMutation.isPending ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <FormattedMessage id="twofactor.enrollment.continue" defaultMessage="Continue" />
              )}
            </Button>
          </DialogActions>
        </form>
      )}

      {/* Step 2: Register Authenticator App */}
      {currentStep === 'scan' && enrollment !== null && (
        <>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <FormattedMessage
                  id="twofactor.enrollment.scan-hint"
                  defaultMessage="Scan this code with your authenticator app, or type the setup key manually."
                />
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                alignItems="center"
                justifyContent="center"
              >
                <Box
                  sx={{
                    p: 2,
                    bgcolor: '#ffffff',
                    borderRadius: 1,
                    display: 'inline-block',
                    flexShrink: 0,
                    boxShadow: 1,
                  }}
                >
                  <QRCodeSVG
                    value={enrollment.otpauthUri}
                    size={192}
                    level="M"
                    includeMargin={false}
                  />
                </Box>
                <Stack spacing={1.5} sx={{ flex: 1, minWidth: 240, width: '100%' }}>
                  <Typography variant="subtitle2" component="h4">
                    <FormattedMessage
                      id="twofactor.enrollment.setup-key-label"
                      defaultMessage="Setup key"
                    />
                  </Typography>
                  <Typography
                    variant="body2"
                    component="code"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      letterSpacing: 2,
                      wordBreak: 'break-all',
                      bgcolor: 'action.hover',
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      userSelect: 'all',
                    }}
                  >
                    {enrollment.setupKey}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    <FormattedMessage
                      id="twofactor.enrollment.parameters"
                      defaultMessage="Algorithm SHA-1 · 6 digits · 30-second period"
                    />
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 0.5 }}>
                    <Button
                      onClick={handleCopySetupKey}
                      variant="outlined"
                      sx={{ minHeight: 44, minWidth: 44 }}
                      aria-label={intl.formatMessage({
                        id: 'twofactor.enrollment.copy-key',
                        defaultMessage: 'Copy setup key to clipboard',
                      })}
                    >
                      <FormattedMessage
                        id="twofactor.enrollment.copy-key-short"
                        defaultMessage="Copy key"
                      />
                    </Button>
                    <Typography
                      variant="body2"
                      color="success.main"
                      aria-live="polite"
                      role="status"
                      sx={{ visibility: copiedKey ? 'visible' : 'hidden' }}
                    >
                      <FormattedMessage
                        id="twofactor.enrollment.copy-success"
                        defaultMessage="Setup key copied to clipboard"
                      />
                    </Typography>
                  </Box>
                </Stack>
              </Stack>

              <Alert severity="warning">
                <FormattedMessage
                  id="twofactor.enrollment.not-yet-active"
                  defaultMessage="Two-step verification is not on yet. Enter a code from your app on the next screen to finish turning it on."
                />
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCancel} color="inherit" sx={{ minHeight: 44 }}>
              <FormattedMessage id="twofactor.enrollment.cancel" defaultMessage="Cancel" />
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setError(undefined);
                setCurrentStep('verify');
              }}
              sx={{ minHeight: 44, minWidth: 100 }}
            >
              <FormattedMessage id="twofactor.enrollment.verify-next" defaultMessage="Enter code" />
            </Button>
          </DialogActions>
        </>
      )}

      {/* Step 3: Verify Code (Story 1.6, UX-DR4, UX-DR9, UX-DR10) */}
      {currentStep === 'verify' && (
        <form onSubmit={handleVerifySubmit} noValidate>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {error && (
                <Alert severity="error" role="alert" aria-live="polite">
                  {codeErrorMessage || (
                    <FormattedMessage
                      id="twofactor.enrollment.verify-failed"
                      defaultMessage="Invalid verification code. Authenticator codes rotate every 30 seconds."
                    />
                  )}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary">
                <FormattedMessage
                  id="twofactor.enrollment.enter-code-intro"
                  defaultMessage="Open your authenticator app and enter the 6-digit code shown for WiseMapping to prove everything works."
                />
              </Typography>

              <Box sx={{ maxWidth: 320, mx: 'auto', width: '100%', py: 1 }}>
                <TextField
                  name="code"
                  inputRef={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  label={intl.formatMessage({
                    id: 'twofactor.enrollment.code-label',
                    defaultMessage: '6-digit code',
                  })}
                  value={code}
                  onChange={(e) => {
                    // UX-DR4: Strip whitespace from typed or pasted code (e.g. "123 456")
                    const clean = e.target.value.replace(/\s+/g, '');
                    if (/^\d{0,6}$/.test(clean)) {
                      setCode(clean);
                    }
                  }}
                  placeholder="123456"
                  required
                  fullWidth
                  disabled={activateMutation.isPending}
                  slotProps={{
                    htmlInput: {
                      maxLength: 6,
                      style: {
                        letterSpacing: '6px',
                        fontSize: '1.4rem',
                        fontFamily: 'monospace',
                        textAlign: 'center',
                      },
                    },
                  }}
                />
              </Box>

              <Typography variant="caption" color="text.secondary" align="center">
                <FormattedMessage
                  id="twofactor.enrollment.rotate-hint"
                  defaultMessage="Codes rotate every 30 seconds. If a code fails, wait for the next one."
                />
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => {
                setError(undefined);
                setCurrentStep('scan');
              }}
              color="inherit"
              disabled={activateMutation.isPending}
              sx={{ minHeight: 44 }}
            >
              <FormattedMessage id="twofactor.enrollment.back" defaultMessage="Back" />
            </Button>
            <Button
              onClick={handleCancel}
              color="inherit"
              disabled={activateMutation.isPending}
              sx={{ minHeight: 44 }}
            >
              <FormattedMessage id="twofactor.enrollment.cancel" defaultMessage="Cancel" />
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={code.length !== 6 || activateMutation.isPending}
              sx={{ minHeight: 44, minWidth: 100 }}
            >
              {activateMutation.isPending ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <FormattedMessage
                  id="twofactor.enrollment.verify-and-activate"
                  defaultMessage="Continue"
                />
              )}
            </Button>
          </DialogActions>
        </form>
      )}

      {/* Step 4: Replacement Done confirmation */}
      {currentStep === 'recovery' && isReplacement && (
        <>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Alert severity="success" role="alert">
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  <FormattedMessage
                    id="twofactor.replacement.success-title"
                    defaultMessage="Authenticator replaced"
                  />
                </Typography>
                <Typography variant="body2">
                  <FormattedMessage
                    id="twofactor.replacement.success-desc"
                    defaultMessage="Your new authenticator app is now active. Your old authenticator no longer works. Your existing recovery codes and remembered browsers remain active."
                  />
                </Typography>
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={onClose} variant="contained" sx={{ minHeight: 44, minWidth: 100 }}>
              <FormattedMessage id="twofactor.enrollment.done" defaultMessage="Done" />
            </Button>
          </DialogActions>
        </>
      )}

      {/* Step 4: Recovery Codes Display (Initial enrollment) */}
      {currentStep === 'recovery' && !isReplacement && (
        <>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Alert severity="success">
                <FormattedMessage
                  id="twofactor.enrollment.activated-success"
                  defaultMessage="Two-step verification is now active! Save these recovery codes in a safe place."
                />
              </Alert>

              <Typography variant="body2" color="text.secondary">
                <FormattedMessage
                  id="twofactor.enrollment.recovery-intro"
                  defaultMessage="If you lose access to your authenticator app, each of these 10 recovery codes can be used once to sign into your account."
                />
              </Typography>

              <Box
                sx={{
                  bgcolor: 'action.hover',
                  p: 2,
                  borderRadius: 1,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1,
                }}
                component="ol"
                role="list"
                aria-label="Recovery codes"
                style={{ listStyle: 'none', margin: 0, padding: 16 }}
              >
                {recoveryCodes.map((c, index) => (
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
                  onClick={handleCopyRecoveryCodes}
                  variant="outlined"
                  sx={{ minHeight: 44, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
                  aria-label={intl.formatMessage({
                    id: 'twofactor.enrollment.copy-recovery-codes',
                    defaultMessage: 'Copy all recovery codes to clipboard',
                  })}
                >
                  <FormattedMessage
                    id="twofactor.enrollment.copy-codes-short"
                    defaultMessage="Copy codes"
                  />
                </Button>
                <Button
                  onClick={handleDownloadRecoveryCodes}
                  variant="outlined"
                  sx={{ minHeight: 44, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
                  aria-label={intl.formatMessage({
                    id: 'twofactor.enrollment.download-recovery-codes',
                    defaultMessage: 'Download recovery codes as a text file',
                  })}
                >
                  <FormattedMessage
                    id="twofactor.enrollment.download-codes"
                    defaultMessage="Download (.txt)"
                  />
                </Button>
                <Button
                  onClick={handlePrintRecoveryCodes}
                  variant="outlined"
                  sx={{ minHeight: 44, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
                  aria-label={intl.formatMessage({
                    id: 'twofactor.enrollment.print-recovery-codes',
                    defaultMessage: 'Print recovery codes',
                  })}
                >
                  <FormattedMessage id="twofactor.enrollment.print-codes" defaultMessage="Print" />
                </Button>
                <Typography
                  variant="body2"
                  color="success.main"
                  aria-live="polite"
                  role="status"
                  sx={{ visibility: copiedRecovery ? 'visible' : 'hidden', ml: 1 }}
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
                      checked={savedAcknowledged}
                      onChange={(e) => setSavedAcknowledged(e.target.checked)}
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
              onClick={onClose}
              variant="contained"
              disabled={!savedAcknowledged}
              sx={{ minHeight: 44, minWidth: 100 }}
            >
              <FormattedMessage id="twofactor.enrollment.done" defaultMessage="Done" />
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default EnrollmentWizard;
