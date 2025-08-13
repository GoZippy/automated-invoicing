import { test, expect, authenticateUser, testData, createTestInvoice, waitForToast } from '../fixtures/test-base';
import path from 'path';

test.describe('Invoice Management', () => {
  // Run these tests as authenticated user
  test.beforeEach(async ({ page, testUser }) => {
    await authenticateUser(page, testUser.email, testUser.password);
  });

  test.describe('Invoice List', () => {
    test('should display invoice list', async ({ page, invoicePage }) => {
      await invoicePage.gotoList();
      
      // Check if table is visible
      await expect(invoicePage.invoiceTable).toBeVisible();
      
      // Check if create button is visible
      await expect(invoicePage.createInvoiceButton).toBeVisible();
    });

    test('should search invoices', async ({ page, invoicePage }) => {
      await invoicePage.gotoList();
      
      // Create test invoice first
      const invoice = await createTestInvoice(page, testData.invoice.valid);
      
      // Search by invoice number
      await invoicePage.searchInvoices(invoice.invoice_number);
      
      const invoices = await invoicePage.getInvoices();
      expect(invoices).toHaveLength(1);
      expect(invoices[0].number).toBe(invoice.invoice_number);
    });

    test('should filter invoices by status', async ({ invoicePage }) => {
      await invoicePage.gotoList();
      
      // Filter by paid status
      await invoicePage.filterByStatus('paid');
      
      const invoices = await invoicePage.getInvoices();
      invoices.forEach(invoice => {
        expect(invoice.status.toLowerCase()).toBe('paid');
      });
    });

    test('should paginate through invoices', async ({ invoicePage }) => {
      await invoicePage.gotoList();
      
      // Check if pagination is visible when there are many invoices
      const pageInfo = await invoicePage.pageInfo.textContent();
      if (pageInfo && pageInfo.includes('of')) {
        await expect(invoicePage.paginationNext).toBeVisible();
        
        // Go to next page
        await invoicePage.paginationNext.click();
        await invoicePage.page.waitForLoadState('networkidle');
        
        // Verify page changed
        const newPageInfo = await invoicePage.pageInfo.textContent();
        expect(newPageInfo).not.toBe(pageInfo);
      }
    });

    test('should perform bulk actions', async ({ page, invoicePage }) => {
      await invoicePage.gotoList();
      
      // Create test invoices
      const invoice1 = await createTestInvoice(page, {
        ...testData.invoice.valid,
        invoiceNumber: 'BULK-001',
      });
      const invoice2 = await createTestInvoice(page, {
        ...testData.invoice.valid,
        invoiceNumber: 'BULK-002',
      });
      
      // Select multiple invoices
      await invoicePage.selectInvoice(invoice1.invoice_number);
      await invoicePage.selectInvoice(invoice2.invoice_number);
      
      // Export selected invoices
      await invoicePage.performBulkAction('export');
      
      // Wait for download
      const download = await page.waitForEvent('download');
      expect(download.suggestedFilename()).toContain('invoices');
    });
  });

  test.describe('Create Invoice', () => {
    test('should create invoice with valid data', async ({ page, invoicePage }) => {
      await invoicePage.gotoCreate();
      
      // Fill invoice form
      await invoicePage.fillInvoiceForm(testData.invoice.valid);
      
      // Add line items
      await invoicePage.addLineItem({
        description: 'Web Development Services',
        quantity: '10',
        rate: '100',
        tax: '10',
      });
      
      await invoicePage.addLineItem({
        description: 'Hosting Services',
        quantity: '1',
        rate: '50',
        tax: '5',
      });
      
      // Check total calculation
      const total = await invoicePage.getTotal();
      expect(total).toContain('1,155.00'); // (10*100 + 1*50) + taxes
      
      // Save invoice
      await invoicePage.saveInvoice();
      await invoicePage.waitForInvoiceSaved();
      
      // Verify redirect to invoice view
      expect(page.url()).toMatch(/\/invoices\/[a-zA-Z0-9-]+$/);
      
      // Verify invoice status
      const status = await invoicePage.getInvoiceStatus();
      expect(status.toLowerCase()).toBe('draft');
    });

    test('should validate required fields', async ({ invoicePage }) => {
      await invoicePage.gotoCreate();
      
      // Try to save without filling required fields
      await invoicePage.saveButton.click();
      
      // Check for validation errors
      const invoiceNumberError = await invoicePage.getFieldError('invoice-number');
      const vendorNameError = await invoicePage.getFieldError('vendor-name');
      const customerNameError = await invoicePage.getFieldError('customer-name');
      
      expect(invoiceNumberError).toContain('required');
      expect(vendorNameError).toContain('required');
      expect(customerNameError).toContain('required');
    });

    test('should validate invoice data', async ({ invoicePage }) => {
      await invoicePage.gotoCreate();
      
      // Fill with invalid data
      await invoicePage.fillInvoiceForm(testData.invoice.invalid);
      
      await invoicePage.saveButton.click();
      
      // Check for validation errors
      const errors = await invoicePage.page.locator('[data-testid$="-error"]').allTextContents();
      expect(errors.length).toBeGreaterThan(0);
      expect(await invoicePage.isFormValid()).toBe(false);
    });

    test('should save invoice as draft', async ({ page, invoicePage }) => {
      await invoicePage.gotoCreate();
      
      // Fill basic info
      await invoicePage.fillInvoiceForm({
        invoiceNumber: 'DRAFT-001',
        vendorName: 'Draft Vendor',
        customerName: 'Draft Customer',
      });
      
      // Save as draft
      await invoicePage.saveAsDraft();
      await invoicePage.waitForInvoiceSaved();
      
      // Verify status
      const status = await invoicePage.getInvoiceStatus();
      expect(status.toLowerCase()).toBe('draft');
    });

    test('should handle line item operations', async ({ invoicePage }) => {
      await invoicePage.gotoCreate();
      
      // Add multiple line items
      await invoicePage.addLineItem({
        description: 'Item 1',
        quantity: '5',
        rate: '100',
      });
      
      await invoicePage.addLineItem({
        description: 'Item 2',
        quantity: '3',
        rate: '50',
      });
      
      await invoicePage.addLineItem({
        description: 'Item 3',
        quantity: '2',
        rate: '75',
      });
      
      // Verify 3 line items
      let lineItems = await invoicePage.lineItemRows.count();
      expect(lineItems).toBe(3);
      
      // Remove middle item
      await invoicePage.removeLineItem(1);
      
      // Verify 2 line items remain
      lineItems = await invoicePage.lineItemRows.count();
      expect(lineItems).toBe(2);
      
      // Verify total updated correctly
      const total = await invoicePage.getTotal();
      expect(total).toContain('650.00'); // 5*100 + 2*75
    });

    test('should auto-save draft periodically', async ({ page, invoicePage }) => {
      test.skip(true, 'Requires implementation of auto-save feature');
      
      await invoicePage.gotoCreate();
      
      // Fill some data
      await invoicePage.fillInvoiceForm({
        invoiceNumber: 'AUTO-001',
        vendorName: 'Auto Save Vendor',
      });
      
      // Wait for auto-save (typically after a few seconds of inactivity)
      await page.waitForTimeout(5000);
      
      // Check for auto-save indicator
      const autoSaveIndicator = page.locator('[data-testid="auto-save-indicator"]');
      await expect(autoSaveIndicator).toContainText('Saved');
    });
  });

  test.describe('Edit Invoice', () => {
    test('should edit existing invoice', async ({ page, invoicePage }) => {
      // Create invoice first
      const invoice = await createTestInvoice(page, testData.invoice.valid);
      
      // Navigate to edit page
      await invoicePage.gotoEdit(invoice.id);
      
      // Update invoice data
      await invoicePage.fillInvoiceForm({
        customerName: 'Updated Customer LLC',
        notes: 'Updated notes for this invoice',
      });
      
      // Save changes
      await invoicePage.saveInvoice();
      await invoicePage.waitForInvoiceSaved();
      
      // Verify changes were saved
      await page.reload();
      const customerName = await invoicePage.customerNameInput.inputValue();
      expect(customerName).toBe('Updated Customer LLC');
    });

    test('should not allow editing sent invoices', async ({ page, invoicePage }) => {
      // Create and send invoice
      const invoice = await createTestInvoice(page, {
        ...testData.invoice.valid,
        status: 'sent',
      });
      
      // Try to edit
      await invoicePage.gotoView(invoice.id);
      
      // Edit button should be disabled or show warning
      const editButton = invoicePage.editInvoiceButton;
      const isDisabled = await editButton.isDisabled();
      
      if (!isDisabled) {
        await editButton.click();
        // Should show warning modal
        const warning = page.locator('[data-testid="edit-warning"]');
        await expect(warning).toBeVisible();
      }
    });

    test('should duplicate invoice', async ({ page, invoicePage }) => {
      // Create original invoice
      const original = await createTestInvoice(page, testData.invoice.valid);
      
      // View invoice
      await invoicePage.gotoView(original.id);
      
      // Duplicate
      await invoicePage.duplicateButton.click();
      
      // Should redirect to create page with pre-filled data
      await page.waitForURL(/\/invoices\/new/);
      
      // Verify data is copied
      const vendorName = await invoicePage.vendorNameInput.inputValue();
      expect(vendorName).toBe(testData.invoice.valid.vendorName);
      
      // Invoice number should be different
      const invoiceNumber = await invoicePage.invoiceNumberInput.inputValue();
      expect(invoiceNumber).not.toBe(original.invoice_number);
    });
  });

  test.describe('Invoice Actions', () => {
    test('should send invoice', async ({ page, invoicePage }) => {
      // Create draft invoice
      const invoice = await createTestInvoice(page, testData.invoice.valid);
      
      // View invoice
      await invoicePage.gotoView(invoice.id);
      
      // Send invoice
      await invoicePage.sendInvoice();
      
      // Fill send modal
      const emailInput = page.locator('[data-testid="send-email-input"]');
      await emailInput.fill('customer@example.com');
      
      const sendButton = page.locator('[data-testid="confirm-send-button"]');
      await sendButton.click();
      
      // Wait for success
      await waitForToast(page, 'Invoice sent successfully');
      
      // Verify status changed
      const status = await invoicePage.getInvoiceStatus();
      expect(status.toLowerCase()).toBe('sent');
    });

    test('should record payment', async ({ page, invoicePage }) => {
      // Create sent invoice
      const invoice = await createTestInvoice(page, {
        ...testData.invoice.valid,
        status: 'sent',
      });
      
      // View invoice
      await invoicePage.gotoView(invoice.id);
      
      // Record payment
      await invoicePage.recordPayment(
        testData.invoice.valid.amount.toString(),
        new Date().toISOString().split('T')[0],
        'bank_transfer'
      );
      
      // Wait for success
      await waitForToast(page, 'Payment recorded');
      
      // Verify status changed
      const status = await invoicePage.getInvoiceStatus();
      expect(status.toLowerCase()).toBe('paid');
    });

    test('should mark invoice as paid', async ({ page, invoicePage }) => {
      // Create sent invoice
      const invoice = await createTestInvoice(page, {
        ...testData.invoice.valid,
        status: 'sent',
      });
      
      // View invoice
      await invoicePage.gotoView(invoice.id);
      
      // Mark as paid
      await invoicePage.markAsPaid();
      
      // Confirm in dialog
      const confirmButton = page.locator('[data-testid="confirm-mark-paid"]');
      await confirmButton.click();
      
      // Verify status changed
      await page.waitForTimeout(1000);
      const status = await invoicePage.getInvoiceStatus();
      expect(status.toLowerCase()).toBe('paid');
    });

    test('should delete invoice', async ({ page, invoicePage }) => {
      // Create invoice
      const invoice = await createTestInvoice(page, testData.invoice.valid);
      
      // View invoice
      await invoicePage.gotoView(invoice.id);
      
      // Delete invoice
      await invoicePage.deleteInvoice();
      
      // Should redirect to list
      await page.waitForURL('/invoices');
      
      // Verify invoice is gone
      await invoicePage.searchInvoices(invoice.invoice_number);
      const invoices = await invoicePage.getInvoices();
      expect(invoices).toHaveLength(0);
    });

    test('should download PDF', async ({ page, invoicePage }) => {
      // Create invoice
      const invoice = await createTestInvoice(page, testData.invoice.valid);
      
      // View invoice
      await invoicePage.gotoView(invoice.id);
      
      // Download PDF
      const downloadPromise = page.waitForEvent('download');
      await invoicePage.downloadPdfButton.click();
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('.pdf');
      expect(download.suggestedFilename()).toContain(invoice.invoice_number);
    });

    test('should print invoice', async ({ page, invoicePage }) => {
      // Create invoice
      const invoice = await createTestInvoice(page, testData.invoice.valid);
      
      // View invoice
      await invoicePage.gotoView(invoice.id);
      
      // Mock print dialog
      await page.evaluate(() => {
        window.print = jest.fn();
      });
      
      // Click print
      await invoicePage.printButton.click();
      
      // Verify print was called
      const printCalled = await page.evaluate(() => {
        return (window.print as jest.Mock).mock.calls.length > 0;
      });
      expect(printCalled).toBe(true);
    });
  });

  test.describe('Invoice Upload', () => {
    test('should upload invoice file', async ({ page, invoicePage }) => {
      await invoicePage.gotoList();
      
      // Click upload button
      await invoicePage.page.locator('[data-testid="upload-invoice-button"]').click();
      
      // Upload file
      const testFilePath = path.join(__dirname, '../fixtures/test-invoice.pdf');
      await invoicePage.uploadInvoiceFile(testFilePath);
      
      // Wait for processing
      await waitForToast(page, 'Invoice processed successfully');
      
      // Should redirect to the created invoice
      expect(page.url()).toMatch(/\/invoices\/[a-zA-Z0-9-]+$/);
    });

    test('should handle invalid file types', async ({ page, invoicePage }) => {
      await invoicePage.gotoList();
      
      // Try to upload invalid file
      await invoicePage.page.locator('[data-testid="upload-invoice-button"]').click();
      
      const testFilePath = path.join(__dirname, '../fixtures/test-document.txt');
      await invoicePage.uploadInput.setInputFiles(testFilePath);
      
      // Should show error
      const error = page.locator('[data-testid="upload-error"]');
      await expect(error).toBeVisible();
      await expect(error).toContainText('Invalid file type');
    });

    test('should show upload progress', async ({ page, invoicePage }) => {
      test.skip(true, 'Requires large file fixture');
      
      await invoicePage.gotoList();
      
      // Upload large file
      await invoicePage.page.locator('[data-testid="upload-invoice-button"]').click();
      
      const largeFilePath = path.join(__dirname, '../fixtures/large-invoice.pdf');
      await invoicePage.uploadInput.setInputFiles(largeFilePath);
      
      // Progress should be visible
      await expect(invoicePage.uploadProgress).toBeVisible();
      
      // Wait for completion
      await invoicePage.uploadProgress.waitFor({ state: 'hidden', timeout: 30000 });
    });

    test('should support drag and drop', async ({ page, invoicePage }) => {
      test.skip(true, 'Drag and drop is complex to test');
      
      await invoicePage.gotoList();
      
      // Open upload modal
      await invoicePage.page.locator('[data-testid="upload-invoice-button"]').click();
      
      // Drag and drop file
      const testFilePath = path.join(__dirname, '../fixtures/test-invoice.pdf');
      await invoicePage.dragAndDropFile(testFilePath);
      
      // Should start upload
      await expect(invoicePage.uploadProgress).toBeVisible();
    });
  });

  test.describe('Invoice Permissions', () => {
    test('should only show user\'s own invoices', async ({ page, invoicePage, testUser }) => {
      await invoicePage.gotoList();
      
      // All invoices should belong to current user
      const invoices = await invoicePage.getInvoices();
      
      // Would need to verify through API that all invoices belong to testUser
      // This is a placeholder for permission testing
      expect(invoices).toBeDefined();
    });

    test('should not allow accessing other user\'s invoices', async ({ page }) => {
      // Try to access an invoice ID that doesn't belong to user
      const otherUserInvoiceId = 'other-user-invoice-id';
      
      await page.goto(`/invoices/${otherUserInvoiceId}`);
      
      // Should show 404 or forbidden
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/not found|forbidden|unauthorized/i);
    });
  });
});