import { test, expect } from '../fixtures/test-base';

test.describe('Authentication Flows', () => {
  test.describe('Login', () => {
    test('should login with valid credentials', async ({ page, authPage, testUser }) => {
      // Create a test user first (in a real app, this would be seeded)
      await authPage.goto('register');
      await authPage.register(testUser.name, testUser.email, testUser.password, testUser.password);
      await authPage.logout();
      
      // Now test login
      await authPage.goto('login');
      await authPage.login(testUser.email, testUser.password);
      
      // Verify successful login
      await authPage.waitForLoginSuccess();
      expect(page.url()).toContain('/dashboard');
      expect(await authPage.isLoggedIn()).toBe(true);
    });

    test('should show error with invalid credentials', async ({ authPage }) => {
      await authPage.goto('login');
      await authPage.login('invalid@example.com', 'wrongpassword');
      
      const error = await authPage.getLoginError();
      expect(error).toContain('Invalid login credentials');
      expect(await authPage.isLoggedIn()).toBe(false);
    });

    test('should validate email format', async ({ authPage }) => {
      await authPage.goto('login');
      
      // Invalid email format
      await authPage.emailInput.fill('invalid-email');
      await authPage.passwordInput.fill('password123');
      await authPage.loginButton.click();
      
      const emailError = await authPage.getFieldError('email');
      expect(emailError).toContain('valid email');
    });

    test('should require all fields', async ({ authPage }) => {
      await authPage.goto('login');
      
      // Try to submit empty form
      await authPage.loginButton.click();
      
      const emailError = await authPage.getFieldError('email');
      const passwordError = await authPage.getFieldError('password');
      
      expect(emailError).toContain('required');
      expect(passwordError).toContain('required');
    });

    test('should remember user with remember me checkbox', async ({ page, authPage, testUser }) => {
      await authPage.goto('login');
      await authPage.login(testUser.email, testUser.password, true);
      
      // Check if remember me token is set
      const cookies = await page.context().cookies();
      const rememberToken = cookies.find(c => c.name === 'remember_token');
      expect(rememberToken).toBeDefined();
      expect(rememberToken?.expires).toBeGreaterThan(Date.now() / 1000 + 604800); // > 7 days
    });

    test('should redirect to requested page after login', async ({ page, authPage, testUser }) => {
      // Try to access protected page
      await page.goto('/invoices/new?redirect=/invoices/new');
      
      // Should be redirected to login
      expect(page.url()).toContain('/auth/login');
      
      // Login
      await authPage.login(testUser.email, testUser.password);
      
      // Should be redirected back to requested page
      await page.waitForURL('/invoices/new');
      expect(page.url()).toContain('/invoices/new');
    });

    test('should handle OAuth login', async ({ authPage }) => {
      test.skip(true, 'OAuth requires external service setup');
      
      await authPage.goto('login');
      await authPage.loginWithGoogle();
      
      // Would need to handle OAuth flow
      // This is a placeholder for when OAuth is implemented
    });
  });

  test.describe('Registration', () => {
    test('should register new user successfully', async ({ page, authPage }) => {
      const timestamp = Date.now();
      const newUser = {
        name: 'New User',
        email: `newuser${timestamp}@example.com`,
        password: 'SecurePass123!',
      };
      
      await authPage.goto('register');
      await authPage.register(newUser.name, newUser.email, newUser.password, newUser.password);
      
      // Verify successful registration
      await authPage.waitForRegisterSuccess();
      expect(page.url()).toContain('/dashboard');
      expect(await authPage.isLoggedIn()).toBe(true);
    });

    test('should show error for existing email', async ({ authPage, testUser }) => {
      // First registration
      await authPage.goto('register');
      await authPage.register(testUser.name, testUser.email, testUser.password, testUser.password);
      await authPage.logout();
      
      // Try to register again with same email
      await authPage.goto('register');
      await authPage.register('Another User', testUser.email, 'AnotherPass123!', 'AnotherPass123!');
      
      const error = await authPage.getRegisterError();
      expect(error).toContain('already registered');
    });

    test('should validate password requirements', async ({ authPage }) => {
      await authPage.goto('register');
      
      const user = {
        name: 'Test User',
        email: 'test@example.com',
      };
      
      // Weak password
      await authPage.nameInput.fill(user.name);
      await authPage.emailInput.fill(user.email);
      await authPage.passwordInput.fill('weak');
      await authPage.confirmPasswordInput.fill('weak');
      await authPage.termsCheckbox.check();
      await authPage.registerButton.click();
      
      const passwordError = await authPage.getFieldError('password');
      expect(passwordError).toContain('at least 8 characters');
    });

    test('should validate password confirmation', async ({ authPage }) => {
      await authPage.goto('register');
      
      await authPage.nameInput.fill('Test User');
      await authPage.emailInput.fill('test@example.com');
      await authPage.passwordInput.fill('SecurePass123!');
      await authPage.confirmPasswordInput.fill('DifferentPass123!');
      await authPage.termsCheckbox.check();
      await authPage.registerButton.click();
      
      const confirmError = await authPage.getFieldError('confirmPassword');
      expect(confirmError).toContain('match');
    });

    test('should require accepting terms', async ({ authPage }) => {
      await authPage.goto('register');
      
      await authPage.nameInput.fill('Test User');
      await authPage.emailInput.fill('test@example.com');
      await authPage.passwordInput.fill('SecurePass123!');
      await authPage.confirmPasswordInput.fill('SecurePass123!');
      // Don't check terms
      
      expect(await authPage.isRegisterButtonDisabled()).toBe(true);
    });
  });

  test.describe('Password Reset', () => {
    test('should send password reset email', async ({ authPage, testUser }) => {
      // Ensure user exists
      await authPage.goto('register');
      await authPage.register(testUser.name, testUser.email, testUser.password, testUser.password);
      await authPage.logout();
      
      // Request password reset
      await authPage.goto('forgot-password');
      await authPage.requestPasswordReset(testUser.email);
      
      await authPage.waitForResetSuccess();
      const successMessage = await authPage.resetSuccess.textContent();
      expect(successMessage).toContain('Check your email');
    });

    test('should show error for non-existent email', async ({ authPage }) => {
      await authPage.goto('forgot-password');
      await authPage.requestPasswordReset('nonexistent@example.com');
      
      const error = await authPage.getResetError();
      expect(error).toContain('No account found');
    });

    test('should validate email format in reset form', async ({ authPage }) => {
      await authPage.goto('forgot-password');
      
      await authPage.resetEmailInput.fill('invalid-email');
      await authPage.resetButton.click();
      
      const emailError = await authPage.getFieldError('email');
      expect(emailError).toContain('valid email');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between auth pages', async ({ page, authPage }) => {
      // Login -> Register
      await authPage.goto('login');
      await authPage.goToSignup();
      expect(page.url()).toContain('/auth/register');
      
      // Register -> Login
      await authPage.goToLogin();
      expect(page.url()).toContain('/auth/login');
      
      // Login -> Forgot Password
      await authPage.goToForgotPassword();
      expect(page.url()).toContain('/auth/forgot-password');
      
      // Forgot Password -> Login
      await authPage.goToLogin();
      expect(page.url()).toContain('/auth/login');
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async ({ page, authPage, testUser }) => {
      await authPage.goto('login');
      await authPage.login(testUser.email, testUser.password);
      await authPage.waitForLoginSuccess();
      
      // Reload page
      await page.reload();
      
      // Should still be logged in
      expect(await authPage.isLoggedIn()).toBe(true);
      expect(page.url()).toContain('/dashboard');
    });

    test('should logout successfully', async ({ page, authPage, testUser }) => {
      await authPage.goto('login');
      await authPage.login(testUser.email, testUser.password);
      await authPage.waitForLoginSuccess();
      
      // Logout
      await authPage.logout();
      
      // Should be redirected to login
      expect(page.url()).toContain('/auth/login');
      expect(await authPage.isLoggedIn()).toBe(false);
      
      // Try to access protected page
      await page.goto('/dashboard');
      expect(page.url()).toContain('/auth/login');
    });

    test('should handle session expiry', async ({ page, authPage, testUser }) => {
      test.skip(true, 'Requires time manipulation or token manipulation');
      
      await authPage.goto('login');
      await authPage.login(testUser.email, testUser.password);
      
      // Simulate expired token
      await page.evaluate(() => {
        const expiredToken = 'expired.jwt.token';
        localStorage.setItem('auth-token', expiredToken);
      });
      
      // Try to access protected resource
      await page.goto('/invoices');
      
      // Should be redirected to login
      expect(page.url()).toContain('/auth/login');
    });
  });

  test.describe('Security', () => {
    test('should not show password in plain text', async ({ authPage }) => {
      await authPage.goto('login');
      
      await authPage.passwordInput.fill('MySecretPassword');
      
      const inputType = await authPage.passwordInput.getAttribute('type');
      expect(inputType).toBe('password');
    });

    test('should handle XSS attempts in login form', async ({ authPage }) => {
      await authPage.goto('login');
      
      const xssPayload = '<script>alert("XSS")</script>';
      await authPage.emailInput.fill(xssPayload);
      await authPage.passwordInput.fill('password');
      await authPage.loginButton.click();
      
      // Should sanitize input and show validation error
      const error = await authPage.getFieldError('email');
      expect(error).toBeTruthy();
      
      // No alert should appear
      const alerts = await authPage.page.evaluate(() => window.alert);
      expect(alerts).toBeUndefined();
    });

    test('should implement CSRF protection', async ({ page, authPage }) => {
      await authPage.goto('login');
      
      // Check for CSRF token
      const csrfToken = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta?.getAttribute('content');
      });
      
      expect(csrfToken).toBeTruthy();
    });
  });
});