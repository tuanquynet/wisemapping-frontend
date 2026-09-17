import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('react-intl', () => {
  const ReactActual = require('react');
  return {
    FormattedMessage: ({ defaultMessage, id }: { defaultMessage?: string; id?: string }) =>
      ReactActual.createElement('span', null, defaultMessage || id),
    useIntl: () => ({
      formatMessage: ({ defaultMessage, id }: { defaultMessage?: string; id?: string }) =>
        defaultMessage || id,
      formatDate: (date: number) => new Date(date).toISOString(),
    }),
    IntlProvider: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

import { VerifiedActionForm } from '../../src/components/account-security-page/VerifiedActionForm';

describe('VerifiedActionForm (Story 3.1, UX-DR3, UX-DR22, FR26)', () => {
  const defaultProps = {
    consequence: 'This action will invalidate all 10 recovery codes.',
    confirmLabel: 'Confirm action',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders consequence alert first and helper text stating remembered browser is insufficient (AC #1)', () => {
    render(<VerifiedActionForm {...defaultProps} />);

    // Consequence alert
    expect(
      screen.getByText('This action will invalidate all 10 recovery codes.'),
    ).toBeDefined();

    // Helper text
    expect(
      screen.getByText("A remembered browser isn't enough for this change."),
    ).toBeDefined();

    // Confirm button is disabled initially
    const confirmBtn = screen.getByRole('button', { name: 'Confirm action' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  test('code variant applies one-time-code autocomplete and monospace styling (AC #2)', () => {
    render(<VerifiedActionForm {...defaultProps} variant="code" />);

    const input = screen.getByRole('textbox', { name: /Security code/i }) as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.style.fontFamily).toBe('monospace');
  });

  test('password variant applies type="password" (AC #2)', () => {
    render(<VerifiedActionForm {...defaultProps} variant="password" />);

    const input = screen.getByLabelText(/Password/i) as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('password');
  });

  test('typing 6 digits does NOT auto-submit (AC #3, UX-DR3)', () => {
    const onConfirm = jest.fn();
    render(<VerifiedActionForm {...defaultProps} onConfirm={onConfirm} variant="code" />);

    const input = screen.getByRole('textbox', { name: /Security code/i });
    fireEvent.change(input, { target: { value: '123456' } });

    // Invariant: destructive forms must never auto-submit
    expect(onConfirm).not.toHaveBeenCalled();

    // But button becomes enabled
    const confirmBtn = screen.getByRole('button', { name: 'Confirm action' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  test('submitting on button click or Enter key calls onConfirm (AC #3)', () => {
    const onConfirm = jest.fn();
    render(<VerifiedActionForm {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByRole('textbox', { name: /Security code/i });
    fireEvent.change(input, { target: { value: '4N6K3-P9Q2X' } });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm action' });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('4N6K3-P9Q2X', undefined);

    // Enter key submits
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  test('double-click mitigation: button disabled and spinner shown when isPending (AC #6, UX-DR22)', () => {
    const onConfirm = jest.fn();
    const { rerender } = render(
      <VerifiedActionForm {...defaultProps} onConfirm={onConfirm} isPending={false} />,
    );

    const input = screen.getByRole('textbox', { name: /Security code/i });
    fireEvent.change(input, { target: { value: '123456' } });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm action' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);

    // Transition to pending state
    rerender(
      <VerifiedActionForm {...defaultProps} onConfirm={onConfirm} isPending={true} />,
    );

    expect(confirmBtn.disabled).toBe(true);
    expect(screen.getByRole('progressbar')).toBeDefined();

    // Clicking while pending does not fire onConfirm
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    // Cancel button also disabled
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i }) as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
  });

  test('error alert renders with role="alert" and aria-live="polite", preserves input, and restores focus (AC #4)', () => {
    const { rerender } = render(
      <VerifiedActionForm {...defaultProps} error={null} />,
    );

    const input = screen.getByRole('textbox', { name: /Security code/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123456' } });

    // Now error occurs
    rerender(
      <VerifiedActionForm
        {...defaultProps}
        error="Invalid verification code. Please check your authenticator and try again."
      />,
    );

    const errorText = screen.getByText(
      /Invalid verification code. Please check your authenticator and try again./i,
    );
    expect(errorText).toBeDefined();
    const errorAlert = errorText.closest('[role="alert"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.getAttribute('aria-live')).toBe('polite');

    // Input preserved
    expect(input.value).toBe('123456');

    // Focus restored to input field
    expect(document.activeElement).toBe(input);
  });

  test('handles optional reason field for administrative flows (AC #1)', () => {
    const onConfirm = jest.fn();
    render(
      <VerifiedActionForm
        {...defaultProps}
        requireReason={true}
        onConfirm={onConfirm}
      />,
    );

    const factorInput = screen.getByRole('textbox', { name: /Security code/i });
    const reasonInput = screen.getByRole('textbox', { name: /Reason for action/i });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm action' }) as HTMLButtonElement;

    // Factor alone not sufficient when reason is required
    fireEvent.change(factorInput, { target: { value: '123456' } });
    expect(confirmBtn.disabled).toBe(true);

    // Filling reason enables confirm
    fireEvent.change(reasonInput, { target: { value: 'Lost device replacement' } });
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('123456', 'Lost device replacement');
  });

  test('clicking cancel calls onCancel callback', () => {
    const onCancel = jest.fn();
    render(<VerifiedActionForm {...defaultProps} onCancel={onCancel} />);

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
