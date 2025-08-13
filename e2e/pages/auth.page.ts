import { Page, Locator } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  
  // Login form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signupLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly loginError: Locator;
  
  // Register form elements
  readonly nameInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly registerButton: Locator;
  readonly loginLink: Locator;
  readonly termsCheckbox: Locator;
  readonly registerError: Locator;
  
  // Password reset elements
  readonly resetEmailInput: Locator;
  readonly resetButton: Locator;
  readonly backToLoginLink: Locator;
  readonly resetSuccess: Locator;
  readonly resetError: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Login form
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.signupLink = page.locator('[data-testid="signup-link"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
    this.rememberMeCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
    this.loginError = page.locator('[data-testid="login-error"]');
    
    // Register form
    this.nameInput = page.locator('[data-testid="name-input"]');
    this.confirmPasswordInput = page.locator('[data-testid="confirm-password-input"]');
    this.registerButton = page.locator('[data-testid="register-button"]');
    this.loginLink = page.locator('[data-testid="login-link"]');
    this.termsCheckbox = page.locator('[data-testid="terms-checkbox"]');
    this.registerError = page.locator('[data-testid="register-error"]');
    
    // Password reset
    this.resetEmailInput = page.locator('[data-testid="reset-email-input"]');
    this.resetButton = page.locator('[data-testid="reset-button"]');
    this.backToLoginLink = page.locator('[data-testid="back-to-login-link"]');
    this.resetSuccess = page.locator('[data-testid="reset-success"]');
    this.resetError = page.locator('[data-testid="reset-error"]');
  }

  // Navigation methods
  async goto(path: 'login' | 'register' | 'forgot-password' = 'login') {
    await this.page.goto(`/auth/${path}`);
    await this.page.waitForLoadState('networkidle');
  }

  // Login methods
  async login(email: string, password: string, rememberMe = false) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    
    await this.loginButton.click();
  }

  async waitForLoginSuccess() {
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }

  async getLoginError(): Promise<string> {
    await this.loginError.waitFor({ state: 'visible' });
    return await this.loginError.textContent() || '';
  }

  // Register methods
  async register(name: string, email: string, password: string, confirmPassword: string, acceptTerms = true) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    
    if (acceptTerms) {
      await this.termsCheckbox.check();
    }
    
    await this.registerButton.click();
  }

  async waitForRegisterSuccess() {
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }

  async getRegisterError(): Promise<string> {
    await this.registerError.waitFor({ state: 'visible' });
    return await this.registerError.textContent() || '';
  }

  // Password reset methods
  async requestPasswordReset(email: string) {
    await this.resetEmailInput.fill(email);
    await this.resetButton.click();
  }

  async waitForResetSuccess() {
    await this.resetSuccess.waitFor({ state: 'visible' });
  }

  async getResetError(): Promise<string> {
    await this.resetError.waitFor({ state: 'visible' });
    return await this.resetError.textContent() || '';
  }

  // Validation methods
  async isLoginButtonDisabled(): Promise<boolean> {
    return await this.loginButton.isDisabled();
  }

  async isRegisterButtonDisabled(): Promise<boolean> {
    return await this.registerButton.isDisabled();
  }

  async getFieldError(field: 'email' | 'password' | 'name' | 'confirmPassword'): Promise<string> {
    const errorLocator = this.page.locator(`[data-testid="${field}-error"]`);
    
    try {
      await errorLocator.waitFor({ state: 'visible', timeout: 2000 });
      return await errorLocator.textContent() || '';
    } catch {
      return '';
    }
  }

  // Navigation helpers
  async goToSignup() {
    await this.signupLink.click();
    await this.page.waitForURL('/auth/register');
  }

  async goToForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL('/auth/forgot-password');
  }

  async goToLogin() {
    if (await this.loginLink.isVisible()) {
      await this.loginLink.click();
    } else if (await this.backToLoginLink.isVisible()) {
      await this.backToLoginLink.click();
    }
    await this.page.waitForURL('/auth/login');
  }

  // OAuth login methods (if implemented)
  async loginWithGoogle() {
    const googleButton = this.page.locator('[data-testid="google-login-button"]');
    await googleButton.click();
    // Handle OAuth flow...
  }

  async loginWithGitHub() {
    const githubButton = this.page.locator('[data-testid="github-login-button"]');
    await githubButton.click();
    // Handle OAuth flow...
  }

  // Utility methods
  async isLoggedIn(): Promise<boolean> {
    // Check if user is logged in by looking for auth token or checking current URL
    const token = await this.page.evaluate(() => localStorage.getItem('auth-token'));
    return !!token;
  }

  async logout() {
    // If there's a logout button in the header
    const logoutButton = this.page.locator('[data-testid="logout-button"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await this.page.waitForURL('/auth/login');
    }
  }
}