import React, { useRef, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { FormattedMessage } from 'react-intl';
export interface VerifiedActionFormProps {
  /**
   * Mandatory consequence statement explaining what will be invalidated or broken (UX-DR3, FR26).
   */
  consequence: React.ReactNode;
  /**
   * Severity level of the consequence alert. Defaults to 'warning'.
   */
  consequenceSeverity?: 'warning' | 'error' | 'info';
  /**
   * Input variant: 'code' (TOTP or recovery code) or 'password' (e.g. admin reset). Defaults to 'code'.
   */
  variant?: 'code' | 'password';
  /**
   * Label for the factor input field. Defaults to "Security code" or "Password".
   */
  factorLabel?: React.ReactNode;
  /**
   * Placeholder for the factor input field.
   */
  factorPlaceholder?: string;
  /**
   * Explicit helper text for the factor field. Defaults to UX-DR3 standard:
   * "A remembered browser isn't enough for this change."
   */
  helperText?: React.ReactNode;
  /**
   * Whether to include a multiline reason field (used in administrative reset).
   */
  requireReason?: boolean;
  reasonLabel?: React.ReactNode;
  reasonPlaceholder?: string;
  /**
   * Label on the confirm button (e.g. "Turn off", "Regenerate codes", "Continue").
   */
  confirmLabel: React.ReactNode;
  /**
   * Button color for the confirm action ('error' | 'primary' | 'warning'). Defaults to 'primary'.
   */
  confirmColor?: 'error' | 'primary' | 'warning';
  /**
   * Whether the submission mutation is in progress.
   */
  isPending?: boolean;
  /**
   * Error message or node to display in the persistent inline alert.
   */
  error?: React.ReactNode | null;
  /**
   * Callback invoked when user confirms with valid input.
   */
  onConfirm: (factor: string, reason?: string) => void | Promise<void>;
  /**
   * Callback invoked when user cancels.
   */
  onCancel: () => void;
}

/**
 * Reusable verified-action form primitive for sensitive changes (UX-DR3, FR26).
 *
 * Implements architecture D10's verify-then-act pattern:
 * - Mandatory consequence Alert first (what will be invalidated).
 * - Single factor field (code with monospace styling or password).
 * - Mandatory helper line: "A remembered browser isn't enough for this change."
 * - Optional multiline reason field.
 * - Persistent inline error Alert (role="alert", aria-live="polite").
 * - Action row with Cancel and Confirm buttons.
 * - No auto-submit on 6 digits (destructive actions require explicit intent).
 * - Double-click mitigation (UX-DR22) prevents spending two recovery codes.
 * - Input preserved and focus restored on error.
 */
export const VerifiedActionForm: React.FC<VerifiedActionFormProps> = ({
  consequence,
  consequenceSeverity = 'warning',
  variant = 'code',
  factorLabel,
  factorPlaceholder,
  helperText,
  requireReason = false,
  reasonLabel,
  reasonPlaceholder,
  confirmLabel,
  confirmColor = 'primary',
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [factor, setFactor] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // UX-DR3: Focus returns to factor field on error, input is preserved
  useEffect(() => {
    if (error) {
      inputRef.current?.focus();
    }
  }, [error]);

  const handleFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (variant === 'code') {
      // Allow user to paste formatted codes (e.g. 123 456 or 4N6K3-P9Q2X), normalize whitespace
      setFactor(val.trim());
    } else {
      setFactor(val);
    }
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReason(e.target.value);
  };

  const isFactorValid = factor.trim().length > 0;
  const isReasonValid = !requireReason || reason.trim().length > 0;
  const canSubmit = isFactorValid && isReasonValid && !isPending;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    // UX-DR22: Ignore duplicate submissions while pending
    if (!canSubmit) {
      return;
    }
    onConfirm(factor.trim(), requireReason ? reason.trim() : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // For textarea reason, allow Enter with Shift or don't submit on bare enter if multiline
      if (e.target === inputRef.current) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const resolvedFactorLabel =
    factorLabel ??
    (variant === 'code' ? (
      <FormattedMessage id="twofactor.verified-form.code-label" defaultMessage="Security code" />
    ) : (
      <FormattedMessage id="twofactor.verified-form.password-label" defaultMessage="Password" />
    ));

  const resolvedPlaceholder =
    factorPlaceholder ?? (variant === 'code' ? '123456 or recovery code' : undefined);

  const resolvedHelperText = helperText ?? (
    <FormattedMessage
      id="twofactor.verified-form.browser-not-enough"
      defaultMessage="A remembered browser isn't enough for this change."
    />
  );

  const resolvedReasonLabel = reasonLabel ?? (
    <FormattedMessage
      id="twofactor.verified-form.reason-label"
      defaultMessage="Reason for action"
    />
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}
    >
      {/* 1. Mandatory consequence Alert (UX-DR3) */}
      <Alert severity={consequenceSeverity} role="alert">
        {consequence}
      </Alert>

      {/* 2. Error region if present (UX-DR10, role="alert", aria-live="polite") */}
      {error && (
        <Alert severity="error" role="alert" aria-live="polite">
          {error}
        </Alert>
      )}

      {/* 3. Factor verification field */}
      <Box>
        <TextField
          inputRef={inputRef}
          fullWidth
          required
          label={resolvedFactorLabel}
          placeholder={resolvedPlaceholder}
          value={factor}
          onChange={handleFactorChange}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          type={variant === 'password' ? 'password' : 'text'}
          autoComplete={variant === 'password' ? 'current-password' : 'one-time-code'}
          helperText={resolvedHelperText}
          slotProps={{
            htmlInput: {
              ...(variant === 'code'
                ? {
                    style: {
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      letterSpacing: '2px',
                    },
                  }
                : {}),
            },
          }}
        />
      </Box>

      {/* 4. Optional Reason field (e.g. Admin reset) */}
      {requireReason && (
        <TextField
          fullWidth
          required
          multiline
          rows={3}
          label={resolvedReasonLabel}
          placeholder={reasonPlaceholder}
          value={reason}
          onChange={handleReasonChange}
          disabled={isPending}
        />
      )}

      {/* 5. Action buttons */}
      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'flex-end', pt: 1 }}
      >
        <Button
          variant="outlined"
          color="inherit"
          onClick={onCancel}
          disabled={isPending}
          sx={{ minHeight: 44, minWidth: 80 }}
        >
          <FormattedMessage id="twofactor.action.cancel" defaultMessage="Cancel" />
        </Button>
        <Button
          type="submit"
          variant="contained"
          color={confirmColor}
          disabled={!canSubmit}
          sx={{ minHeight: 44, minWidth: 100 }}
        >
          {isPending ? <CircularProgress size={22} color="inherit" /> : confirmLabel}
        </Button>
      </Stack>
    </Box>
  );
};

export default VerifiedActionForm;
