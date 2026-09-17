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

/// <reference types="cypress" />
/// <reference types="cypress-axe" />

describe('Automated Accessibility Checks (Story 5.1, UX-DR24, UX-DR27)', () => {
  const modes: ('light' | 'dark')[] = ['light', 'dark'];

  modes.forEach((mode) => {
    describe(`${mode} mode`, () => {
      beforeEach(() => {
        // Set theme mode in localStorage if needed or toggle
        window.localStorage.setItem('theme-mode', mode);
      });

      it(`Security Page (/c/account/security) passes a11y checks in ${mode} mode`, () => {
        cy.visit('/c/account/security');
        cy.waitForPageLoaded();
        cy.injectAxe();
        // Assert no accessibility violations
        cy.checkA11y();
      });

      it(`Login Page (/c/login) passes a11y checks in ${mode} mode`, () => {
        cy.clearCookie('jwt-auth-token');
        cy.visit('/c/login');
        cy.waitForPageLoaded();
        cy.injectAxe();
        cy.checkA11y();
      });

      it(`Admin Accounts Page (/c/admin/accounts) passes a11y checks in ${mode} mode`, () => {
        cy.visit('/c/admin/accounts');
        cy.waitForPageLoaded();
        cy.injectAxe();
        cy.checkA11y();
      });
    });
  });
});
