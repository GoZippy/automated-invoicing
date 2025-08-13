import { test, expect, testData, waitForToast } from '../fixtures/test-base';

test.describe('Complete User Journey', () => {
  test('should complete full workflow from registration to paid invoice', async ({ 
    page, 
    authPage, 
    dashboardPage, 
    invoicePage 
  }) => {
    // Step 1: Register new user
    const timestamp = Date.now();
    const newUser = {
      name: 'Journey User',
      email: `journey.user.${timestamp}@example.com`,
      password: 'JourneyPass123!',
    };
    
    await authPage.goto('register');
    await authPage.register(newUser.name, newUser.email, newUser.password, newUser.password);
    await authPage.waitForRegisterSuccess();
    
    // Step 2: Verify dashboard loads
    expect(page.url()).toContain('/dashboard');
    await dashboardPage.waitForPageLoad();
    
    // Check initial state - should have no invoices
    const initialRevenue = await dashboardPage.getTotalRevenue();
    expect(initialRevenue).toContain('0');
    
    const pendingCount = await dashboardPage.getPendingInvoicesCount();
    expect(pendingCount).toBe(0);
    
    // Step 3: Create first invoice
    await dashboardPage.createNewInvoice();
    
    // Fill invoice details
    const invoiceData = {
      invoiceNumber: `JRN-${timestamp}`,
      vendorName: 'Journey Vendor Inc',
      customerName: 'Journey Customer LLC',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'USD',
      notes: 'First invoice in user journey test',
    };
    
    await invoicePage.fillInvoiceForm(invoiceData);
    
    // Add line items
    await invoicePage.addLineItem({
      description: 'Consulting Services',
      quantity: '10',
      rate: '150',
      tax: '10',
    });
    
    await invoicePage.addLineItem({
      description: 'Software License',
      quantity: '1',
      rate: '500',
      tax: '10',
    });
    
    // Verify total calculation
    const total = await invoicePage.getTotal();
    expect(total).toContain('2,200.00'); // (10*150 + 500) * 1.1
    
    // Save invoice
    await invoicePage.saveInvoice();
    await invoicePage.waitForInvoiceSaved();
    
    // Step 4: Send invoice to customer
    await invoicePage.sendInvoice();
    
    // Fill send details
    const emailInput = page.locator('[data-testid="send-email-input"]');
    await emailInput.fill('customer@journey.com');
    
    const messageInput = page.locator('[data-testid="send-message-input"]');
    await messageInput.fill('Please find attached invoice for our services.');
    
    const confirmSendButton = page.locator('[data-testid="confirm-send-button"]');
    await confirmSendButton.click();
    
    await waitForToast(page, 'Invoice sent successfully');
    
    // Verify status changed to sent
    const sentStatus = await invoicePage.getInvoiceStatus();
    expect(sentStatus.toLowerCase()).toBe('sent');
    
    // Step 5: Go back to dashboard and verify metrics updated
    await dashboardPage.goto();
    await dashboardPage.waitForDataToLoad();
    
    // Should now show pending invoice
    const updatedPendingCount = await dashboardPage.getPendingInvoicesCount();
    expect(updatedPendingCount).toBe(1);
    
    // Check recent invoices table
    const recentInvoices = await dashboardPage.getRecentInvoices();
    expect(recentInvoices).toHaveLength(1);
    expect(recentInvoices[0].number).toBe(invoiceData.invoiceNumber);
    expect(recentInvoices[0].status.toLowerCase()).toBe('sent');
    
    // Step 6: Search for the invoice
    await dashboardPage.searchFor(invoiceData.invoiceNumber);
    await page.waitForLoadState('networkidle');
    
    // Should navigate to search results or invoice
    expect(page.url()).toContain(invoiceData.invoiceNumber);
    
    // Step 7: Record payment for the invoice
    await invoicePage.gotoView(recentInvoices[0].number); // Assumes invoice ID in URL
    
    await invoicePage.recordPayment(
      '2200.00',
      new Date().toISOString().split('T')[0],
      'credit_card'
    );
    
    await waitForToast(page, 'Payment recorded');
    
    // Verify status changed to paid
    const paidStatus = await invoicePage.getInvoiceStatus();
    expect(paidStatus.toLowerCase()).toBe('paid');
    
    // Step 8: Download invoice PDF
    const downloadPromise = page.waitForEvent('download');
    await invoicePage.downloadPdfButton.click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.pdf');
    expect(download.suggestedFilename()).toContain(invoiceData.invoiceNumber);
    
    // Step 9: Return to dashboard and verify final state
    await dashboardPage.goto();
    await dashboardPage.waitForDataToLoad();
    
    // Revenue should be updated
    const finalRevenue = await dashboardPage.getTotalRevenue();
    expect(finalRevenue).toContain('2,200');
    
    // No more pending invoices
    const finalPendingCount = await dashboardPage.getPendingInvoicesCount();
    expect(finalPendingCount).toBe(0);
    
    // Check charts are visible
    expect(await dashboardPage.isRevenueChartVisible()).toBe(true);
    
    // Step 10: Test user menu and logout
    await dashboardPage.openUserMenu();
    
    // Verify user info is displayed
    const userMenuName = page.locator('[data-testid="user-menu-name"]');
    await expect(userMenuName).toContainText(newUser.name);
    
    // Logout
    await dashboardPage.logout();
    
    // Should be redirected to login
    expect(page.url()).toContain('/auth/login');
    
    // Verify can't access protected pages
    await page.goto('/dashboard');
    expect(page.url()).toContain('/auth/login');
  });

  test('should handle AI-powered invoice upload workflow', async ({ 
    page, 
    authPage, 
    dashboardPage, 
    invoicePage,
    testUser 
  }) => {
    // Login
    await authPage.goto('login');
    await authPage.login(testUser.email, testUser.password);
    await authPage.waitForLoginSuccess();
    
    // Navigate to invoices
    await dashboardPage.navigateTo('invoices');
    
    // Upload invoice
    await page.locator('[data-testid="upload-invoice-button"]').click();
    
    // Wait for upload modal
    const uploadModal = page.locator('[data-testid="upload-modal"]');
    await expect(uploadModal).toBeVisible();
    
    // Upload test invoice file
    const testInvoicePath = path.join(__dirname, '../fixtures/test-invoice.pdf');
    await invoicePage.uploadInput.setInputFiles(testInvoicePath);
    
    // Wait for AI processing
    await expect(invoicePage.uploadProgress).toBeVisible();
    await waitForToast(page, 'Processing invoice with AI...');
    
    // Wait for extraction to complete
    await page.waitForSelector('[data-testid="extraction-complete"]', { timeout: 30000 });
    
    // Verify extracted data is shown for review
    const extractedDataModal = page.locator('[data-testid="extracted-data-modal"]');
    await expect(extractedDataModal).toBeVisible();
    
    // Check some extracted fields
    const extractedNumber = page.locator('[data-testid="extracted-invoice-number"]');
    const extractedVendor = page.locator('[data-testid="extracted-vendor"]');
    const extractedAmount = page.locator('[data-testid="extracted-amount"]');
    
    await expect(extractedNumber).toHaveValue(/.+/); // Should have some value
    await expect(extractedVendor).toHaveValue(/.+/);
    await expect(extractedAmount).toHaveValue(/\d+/);
    
    // Make corrections if needed
    await extractedVendor.clear();
    await extractedVendor.fill('Corrected Vendor Name');
    
    // Confirm and save
    const confirmButton = page.locator('[data-testid="confirm-extraction-button"]');
    await confirmButton.click();
    
    // Wait for invoice to be created
    await waitForToast(page, 'Invoice created successfully');
    await page.waitForURL(/\/invoices\/[a-zA-Z0-9-]+$/);
    
    // Verify invoice was created with extracted data
    const invoiceVendor = await invoicePage.vendorNameInput.inputValue();
    expect(invoiceVendor).toBe('Corrected Vendor Name');
  });

  test('should handle natural language chat interaction', async ({ 
    page, 
    authPage, 
    dashboardPage,
    testUser 
  }) => {
    // Login
    await authPage.goto('login');
    await authPage.login(testUser.email, testUser.password);
    await authPage.waitForLoginSuccess();
    
    // Open AI chat
    const chatButton = page.locator('[data-testid="ai-chat-button"]');
    await chatButton.click();
    
    // Wait for chat to open
    const chatWindow = page.locator('[data-testid="ai-chat-window"]');
    await expect(chatWindow).toBeVisible();
    
    // Send natural language query
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('Show me all unpaid invoices from this month');
    await chatInput.press('Enter');
    
    // Wait for AI response
    const aiResponse = page.locator('[data-testid="ai-response"]').last();
    await aiResponse.waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify response contains relevant information
    const responseText = await aiResponse.textContent();
    expect(responseText).toMatch(/invoice|unpaid|month/i);
    
    // Try another query
    await chatInput.fill('What is my total revenue for this year?');
    await chatInput.press('Enter');
    
    // Wait for new response
    const newResponse = page.locator('[data-testid="ai-response"]').last();
    await newResponse.waitFor({ state: 'visible', timeout: 10000 });
    
    const revenueResponse = await newResponse.textContent();
    expect(revenueResponse).toMatch(/revenue|total|year/i);
    
    // Close chat
    const closeButton = page.locator('[data-testid="close-chat-button"]');
    await closeButton.click();
    await expect(chatWindow).not.toBeVisible();
  });

  test('should handle mobile responsive workflow', async ({ 
    page, 
    authPage, 
    dashboardPage,
    invoicePage,
    testUser 
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    // Login on mobile
    await authPage.goto('login');
    await authPage.login(testUser.email, testUser.password);
    await authPage.waitForLoginSuccess();
    
    // Check mobile menu
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenuButton).toBeVisible();
    
    // Open mobile menu
    await mobileMenuButton.click();
    
    const mobileNav = page.locator('[data-testid="mobile-navigation"]');
    await expect(mobileNav).toBeVisible();
    
    // Navigate to invoices on mobile
    const mobileInvoicesLink = page.locator('[data-testid="mobile-nav-invoices"]');
    await mobileInvoicesLink.click();
    
    // Check if table is responsive
    await invoicePage.invoiceTable.waitFor({ state: 'visible' });
    
    // Should show mobile-optimized view
    const mobileInvoiceCards = page.locator('[data-testid="mobile-invoice-card"]');
    const desktopTable = page.locator('[data-testid="desktop-invoice-table"]');
    
    // On mobile, cards should be visible, table hidden
    if (await mobileInvoiceCards.first().isVisible()) {
      expect(await desktopTable.isVisible()).toBe(false);
    }
    
    // Test swipe actions if implemented
    const firstInvoiceCard = mobileInvoiceCards.first();
    if (await firstInvoiceCard.isVisible()) {
      // Simulate swipe to reveal actions
      await firstInvoiceCard.dragTo(firstInvoiceCard, {
        sourcePosition: { x: 300, y: 50 },
        targetPosition: { x: 100, y: 50 },
      });
      
      // Check if actions are revealed
      const swipeActions = page.locator('[data-testid="swipe-actions"]');
      await expect(swipeActions).toBeVisible();
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should handle error scenarios gracefully', async ({ 
    page, 
    authPage, 
    invoicePage,
    testUser 
  }) => {
    // Login
    await authPage.goto('login');
    await authPage.login(testUser.email, testUser.password);
    await authPage.waitForLoginSuccess();
    
    // Test network error handling
    await page.route('**/api/invoices', route => {
      route.abort('failed');
    });
    
    await invoicePage.gotoList();
    
    // Should show error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/error|failed|try again/i);
    
    // Should have retry button
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
    
    // Clear route override
    await page.unroute('**/api/invoices');
    
    // Test form submission error
    await invoicePage.gotoCreate();
    
    // Mock API error for invoice creation
    await page.route('**/api/invoices', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Invoice number already exists',
            code: 'DUPLICATE_INVOICE',
          },
        }),
      });
    });
    
    // Fill and submit form
    await invoicePage.fillInvoiceForm(testData.invoice.valid);
    await invoicePage.saveInvoice();
    
    // Should show error toast or message
    const errorToast = page.locator('[role="alert"]');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('Invoice number already exists');
    
    // Form should still be visible with data intact
    const invoiceNumber = await invoicePage.invoiceNumberInput.inputValue();
    expect(invoiceNumber).toBe(testData.invoice.valid.invoiceNumber);
  });
});

// Import path for file upload test
import path from 'path';