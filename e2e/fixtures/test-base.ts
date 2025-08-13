import { test as base } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';
import { DashboardPage } from '../pages/dashboard.page';
import { InvoicePage } from '../pages/invoice.page';

// Define custom fixtures
type TestFixtures = {
  authPage: AuthPage;
  dashboardPage: DashboardPage;
  invoicePage: InvoicePage;
  testUser: {
    email: string;
    password: string;
    name: string;
  };
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  // Page object fixtures
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  invoicePage: async ({ page }, use) => {
    await use(new InvoicePage(page));
  },

  // Test user fixture
  testUser: async ({}, use) => {
    // Generate unique test user for each test
    const timestamp = Date.now();
    const testUser = {
      email: `test.user.${timestamp}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
    };
    
    await use(testUser);
    
    // Cleanup: Delete test user after test (if needed)
    // This would require calling your API to delete the user
  },
});

// Re-export expect from Playwright
export { expect } from '@playwright/test';

// Test data helpers
export const testData = {
  invoice: {
    valid: {
      invoiceNumber: 'INV-TEST-001',
      vendorName: 'Test Vendor Inc',
      customerName: 'Test Customer LLC',
      amount: 1000.00,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    },
    invalid: {
      invoiceNumber: '', // Invalid: empty
      vendorName: 'A', // Invalid: too short
      customerName: '',
      amount: -100, // Invalid: negative
      dueDate: '2020-01-01', // Invalid: past date
    },
  },
  
  files: {
    validInvoice: 'test-invoice.pdf',
    invalidFile: 'test-document.txt',
    largeFile: 'large-invoice.pdf', // > 10MB
  },
};

// Utility functions
export async function authenticateUser(page: any, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

export async function createTestInvoice(page: any, invoiceData: any) {
  const response = await page.request.post('/api/invoices', {
    data: invoiceData,
    headers: {
      'Authorization': `Bearer ${await getAuthToken(page)}`,
    },
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create test invoice: ${response.status()}`);
  }
  
  return await response.json();
}

export async function getAuthToken(page: any): Promise<string> {
  // Get auth token from localStorage or cookies
  const token = await page.evaluate(() => {
    return localStorage.getItem('auth-token') || '';
  });
  
  return token;
}

export async function waitForToast(page: any, message: string) {
  await page.waitForSelector(`[role="alert"]:has-text("${message}")`, {
    timeout: 5000,
  });
}

export async function dismissToasts(page: any) {
  const toasts = await page.$$('[role="alert"] button[aria-label="Close"]');
  for (const toast of toasts) {
    await toast.click();
  }
}

// Test environment setup
export async function setupTestEnvironment() {
  // This could include:
  // - Setting up test database
  // - Seeding test data
  // - Configuring test services
  console.log('Setting up test environment...');
}

export async function teardownTestEnvironment() {
  // This could include:
  // - Cleaning up test data
  // - Resetting database state
  // - Closing connections
  console.log('Tearing down test environment...');
}