import React, { useContext, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

import { ErrorInfo } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';

export type TwoFactorChallengeProps = {
  challengeToken: string;
  recoveryAvailable?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

type ChallengeMode = 'totp' | 'recovery';

/**
 * TwoFactorChallenge (Stories 1.8, 1.9, 2.1)
 *
 * Implements:
 * - In-place challenge within the login shell (UX-DR8)
 * - Single numeric TextField, autofocus, autocomplete="one-time-code" for TOTP (UX-DR4)
 * - Peer control to switch between TOTP and recovery code (UX-DR6)
 * - In-place relabelling with no navigation (UX-DR6)
 * - Whitespace stripped from input/paste (UX-DR4)
 * - Auto-submits on 6th digit for TOTP (UX-DR4)
 * - NO auto-submit for recovery code (destructive single-use action, UX-DR3)
 * - Persistent inline error alert (role="alert", aria-live="polite", no toasts/snackbars) (UX-DR10)
 * - Input preserved and focus returned on failure (UX-DR9, UX-DR10)
 * - "Remember this browser" checkbox, never preselected, real scope + shared-computer guidance (FR15, UX-DR7)
 */
export const TwoFactorChallenge = ({
  challengeToken,
  recoveryAvailable = true,
  onSuccess,
  onCancel,
}: TwoFactorChallengeProps): React.ReactElement => {
  const intl = useIntl();
  const client = useContext(ClientContext);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<ErrorInfo>();
  const [rememberDevice, setRememberDevice] = useState<boolean>(false);

  const mutation = useMutation<void, ErrorInfo, { code: string; type: ChallengeMode }>({
    mutationFn: ({ code: submittedCode, type }) =>
      client.completeTwoFactorChallenge({
        challengeToken,
        code: submittedCode,
        type,
        rememberDevice,
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err) => {
      setError(err);
      // UX-DR10: Preserve input and restore focus to the input field
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    },
  });

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (mode === 'totp') {
      // UX-DR4: Strip all internal and external whitespace
      const cleaned = e.target.value.replace(/\s+/g, '');
      if (/^\d{0,6}$/.test(cleaned)) {
        setCode(cleaned);
        if (error) {
          setError(undefined);
        }
        // UX-DR4: Auto-submit on 6th digit
        if (cleaned.length === 6 && !mutation.isPending) {
          mutation.mutate({ code: cleaned, type: 'totp' });
        }
      }
    } else {
      // Recovery mode: uppercase, strip whitespace, allow hyphens
      const cleaned = e.target.value.replace(/\s+/g, '').toUpperCase();
      // Allow up to 11 chars (e.g. 10 base32 chars + optional hyphen)
      if (cleaned.length <= 11) {
        setCode(cleaned);
        if (error) {
          setError(undefined);
        }
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.replace(/\s+/g, '');
    if (mode === 'totp') {
      if (cleaned.length === 6 && !mutation.isPending) {
        mutation.mutate({ code: cleaned, type: 'totp' });
      }
    } else {
      const normalized = cleaned.replace(/-/g, '');
      if (normalized.length === 10 && !mutation.isPending) {
        mutation.mutate({ code: cleaned, type: 'recovery' });
      }
    }
  };

  const handleToggleMode = () => {
    setError(undefined);
    setCode('');
    setMode((current) => (current === 'totp' ? 'recovery' : 'totp'));
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const isCodeComplete =
    mode === 'totp' ? code.length === 6 : code.replace(/[\s-]+/g, '').length === 10;

  // Resolve message adhering to UX-DR9 error taxonomy:
  const getErrorMessage = (): React.ReactNode => {
    if (!error) return null;

    const rawMsg =
      (error?.fields instanceof Map
        ? error.fields.get('code')
        : (error?.fields as unknown as Record<string, string>)?.['code']) || error?.msg;

    // 401 / Timeout: sign-in attempt timed out, NOT a wrong code (UX-DR9)
    if (
      rawMsg?.includes('expired') ||
      rawMsg?.includes('timed out') ||
      rawMsg?.includes('Challenge token is invalid')
    ) {
      return (
        <FormattedMessage
          id="twofactor.challenge.timeout"
          defaultMessage="Your sign-in attempt timed out. Please return to login and try again."
        />
      );
    }

    // 429 / Cooldown: pass through the backend message (protection intact + retry time + recovery hint)
    if (rawMsg?.includes('Too many failed attempts')) {
      return rawMsg;
    }

    // Network / Server error: never worded as an invalid code (UX-DR9)
    if (rawMsg?.includes('Network Error') || rawMsg?.includes('Unexpected error')) {
      return (
        <FormattedMessage
          id="twofactor.challenge.network-error"
          defaultMessage="Unable to reach the server. Please check your internet connection and try again."
        />
      );
    }

    // Direct backend message or fallback
    return (
      rawMsg || (
        <FormattedMessage
          id="twofactor.challenge.error-fallback"
          defaultMessage="Invalid verification code. Authenticator codes rotate every 30 seconds."
        />
      )
    );
  };

  return (
    <Box
      component="form"
      onSubmit={handleFormSubmit}
      noValidate
      sx={{ width: '100%', maxWidth: 400, mx: 'auto', py: 2 }}
    >
      <Stack spacing={2.5}>
        <Box textAlign="center">
          <Typography variant="h5" component="h2" fontWeight={700} gutterBottom>
            {mode === 'totp' ? (
              <FormattedMessage
                id="twofactor.challenge.title"
                defaultMessage="Two-step verification"
              />
            ) : (
              <FormattedMessage
                id="twofactor.challenge.recovery-title"
                defaultMessage="Use a recovery code"
              />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {mode === 'totp' ? (
              <FormattedMessage
                id="twofactor.challenge.instruction"
                defaultMessage="Enter the 6-digit code from your authenticator app to complete sign in."
              />
            ) : (
              <FormattedMessage
                id="twofactor.challenge.recovery-instruction"
                defaultMessage="Enter one of your 10-character recovery codes to sign in without your phone."
              />
            )}
          </Typography>
        </Box>

        {/* UX-DR10: Persistent inline error alert (no toasts or snackbars) */}
        {error && (
          <Alert severity="error" role="alert" aria-live="polite">
            {getErrorMessage()}
          </Alert>
        )}

        <Box sx={{ py: 1 }}>
          <TextField
            name="code"
            inputRef={inputRef}
            type="text"
            inputMode={mode === 'totp' ? 'numeric' : 'text'}
            autoComplete={mode === 'totp' ? 'one-time-code' : 'off'}
            autoFocus
            fullWidth
            required
            label={
              mode === 'totp'
                ? intl.formatMessage({
                    id: 'twofactor.challenge.code-label',
                    defaultMessage: '6-digit code',
                  })
                : intl.formatMessage({
                    id: 'twofactor.challenge.recovery-label',
                    defaultMessage: '10-character recovery code',
                  })
            }
            placeholder={mode === 'totp' ? '123456' : '4N6K3-P9Q2X'}
            value={code}
            onChange={handleCodeChange}
            disabled={mutation.isPending}
            slotProps={{
              htmlInput: {
                maxLength: mode === 'totp' ? 6 : 11,
                style: {
                  letterSpacing: mode === 'totp' ? '8px' : '4px',
                  fontSize: '1.4rem',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                },
              },
            }}
          />
        </Box>

        {mode === 'totp' && (
          <Typography variant="caption" color="text.secondary" align="center">
            <FormattedMessage
              id="twofactor.challenge.rotate-hint"
              defaultMessage="Codes rotate every 30 seconds."
            />
          </Typography>
        )}

        {/* UX-DR7: Device-trust checkbox directly beneath the field, never preselected,
            labelled with its real scope plus one line of shared-computer guidance (FR15). */}
        <FormControlLabel
          sx={{ m: 0, alignItems: 'flex-start' }}
          disabled={mutation.isPending}
          control={
            <Checkbox
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              color="primary"
              sx={{ mt: -0.5, pt: 0.5 }}
            />
          }
          label={
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2">
                <FormattedMessage
                  id="twofactor.challenge.remember-device"
                  defaultMessage="Remember this browser for 30 days"
                />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage
                  id="twofactor.challenge.remember-device-guidance"
                  defaultMessage="You'll still enter your password. Don't check this on shared computers."
                />
              </Typography>
            </Box>
          }
        />

        {/* Primary submit button retained for AT and keyboard users (UX-DR4) */}
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={!isCodeComplete || mutation.isPending}
          sx={{ minHeight: 48 }}
        >
          {mutation.isPending ? (
            <CircularProgress size={24} color="inherit" />
          ) : mode === 'totp' ? (
            <FormattedMessage id="twofactor.challenge.verify-button" defaultMessage="Verify" />
          ) : (
            <FormattedMessage
              id="twofactor.challenge.recovery-submit"
              defaultMessage="Sign in with recovery code"
            />
          )}
        </Button>

        {/* UX-DR6: Peer control to switch between authenticator code and recovery code */}
        {recoveryAvailable && (
          <Box textAlign="center" sx={{ pt: 0.5 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={handleToggleMode}
              disabled={mutation.isPending}
              underline="hover"
            >
              {mode === 'totp' ? (
                <FormattedMessage
                  id="twofactor.challenge.use-recovery"
                  defaultMessage="Use a recovery code instead"
                />
              ) : (
                <FormattedMessage
                  id="twofactor.challenge.use-authenticator"
                  defaultMessage="Use an authenticator code instead"
                />
              )}
            </Link>
          </Box>
        )}

        <Box textAlign="center" sx={{ pt: 0.5 }}>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={onCancel}
            disabled={mutation.isPending}
            underline="hover"
            color="text.secondary"
          >
            <FormattedMessage id="twofactor.challenge.cancel-link" defaultMessage="Back to login" />
          </Link>
        </Box>
      </Stack>
    </Box>
  );
};

export default TwoFactorChallenge;
