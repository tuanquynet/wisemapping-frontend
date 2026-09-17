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

import { createAppTheme } from '../../src/theme';
import { organicTokens } from '../../src/theme/tokens';

// Calculate WCAG 2.1 relative luminance
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Calculate WCAG 2.1 contrast ratio
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('createAppTheme (Organic design tokens)', () => {
  test('light theme background uses the Organic cream ground token', () => {
    const theme = createAppTheme('light');
    expect(theme.palette.background.default).toBe(organicTokens.color.ground);
  });

  test('dark theme background uses the Organic dark ground token, not the old grey default', () => {
    const theme = createAppTheme('dark');
    expect(theme.palette.background.default).toBe(organicTokens.color.groundDark);
    expect(theme.palette.background.default).not.toBe('#2a2a2a');
  });

  test('primary color uses the Organic terracotta accent in light mode', () => {
    const theme = createAppTheme('light');
    expect(theme.palette.primary.main).toBe(organicTokens.color.terracotta);
  });

  test('primary color uses the Organic muted terracotta accent in dark mode', () => {
    const theme = createAppTheme('dark');
    expect(theme.palette.primary.main).toBe(organicTokens.color.terracottaDark);
  });

  test('display heading (h4) uses the Caprasimo display font stack', () => {
    const theme = createAppTheme('light');
    expect(theme.typography.h4.fontFamily).toBe(organicTokens.font.display);
  });

  test('light mode primary button text meets WCAG 2.1 AA contrast requirements (>= 4.5:1) (Story 5.2, UX-DR28)', () => {
    const theme = createAppTheme('light');
    const bg = theme.palette.primary.main;
    const fg = theme.palette.primary.contrastText;

    const ratio = contrastRatio(bg, fg);
    // Pre-remediation #c67139 was 3.61:1 (failing AA). Remediation #a8521d achieves >= 4.5:1.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Record exact measured value to prevent silent regression
    expect(Math.round(ratio * 100) / 100).toBe(5.4);
  });

  test('dark mode primary button text meets WCAG 2.1 AA contrast requirements (>= 4.5:1) (Story 5.2, UX-DR28)', () => {
    const theme = createAppTheme('dark');
    const bg = theme.palette.primary.main;
    const fg = theme.palette.primary.contrastText;

    const ratio = contrastRatio(bg, fg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeGreaterThanOrEqual(6.0);
  });
});
