import { Page, Locator } from '@playwright/test';

export class InvoicePage {
  readonly page: Page;
  
  // Invoice list page elements
  readonly invoiceTable: Locator;
  readonly invoiceRows: Locator;
  readonly createInvoiceButton: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly statusFilter: Locator;
  readonly dateRangeFilter: Locator;
  readonly exportButton: Locator;
  readonly bulkActionsMenu: Locator;
  readonly paginationNext: Locator;
  readonly paginationPrev: Locator;
  readonly pageInfo: Locator;
  
  // Invoice form elements
  readonly invoiceNumberInput: Locator;
  readonly vendorNameInput: Locator;
  readonly customerNameInput: Locator;
  readonly invoiceDateInput: Locator;
  readonly dueDateInput: Locator;
  readonly paymentTermsSelect: Locator;
  readonly currencySelect: Locator;
  readonly notesTextarea: Locator;
  
  // Line items
  readonly addLineItemButton: Locator;
  readonly lineItemRows: Locator;
  readonly subtotalField: Locator;
  readonly taxField: Locator;
  readonly totalField: Locator;
  
  // Actions
  readonly saveButton: Locator;
  readonly saveAsDraftButton: Locator;
  readonly sendButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly duplicateButton: Locator;
  readonly printButton: Locator;
  readonly downloadPdfButton: Locator;
  
  // Invoice view elements
  readonly invoiceStatus: Locator;
  readonly markAsPaidButton: Locator;
  readonly recordPaymentButton: Locator;
  readonly editInvoiceButton: Locator;
  readonly sendReminderButton: Locator;
  
  // Upload elements
  readonly uploadDropzone: Locator;
  readonly uploadInput: Locator;
  readonly uploadProgress: Locator;
  readonly uploadedFile: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // List page
    this.invoiceTable = page.locator('[data-testid="invoice-table"]');
    this.invoiceRows = page.locator('[data-testid="invoice-row"]');
    this.createInvoiceButton = page.locator('[data-testid="create-invoice-button"]');
    this.searchInput = page.locator('[data-testid="invoice-search"]');
    this.filterButton = page.locator('[data-testid="filter-button"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]');
    this.dateRangeFilter = page.locator('[data-testid="date-range-filter"]');
    this.exportButton = page.locator('[data-testid="export-button"]');
    this.bulkActionsMenu = page.locator('[data-testid="bulk-actions-menu"]');
    this.paginationNext = page.locator('[data-testid="pagination-next"]');
    this.paginationPrev = page.locator('[data-testid="pagination-prev"]');
    this.pageInfo = page.locator('[data-testid="page-info"]');
    
    // Form fields
    this.invoiceNumberInput = page.locator('[data-testid="invoice-number-input"]');
    this.vendorNameInput = page.locator('[data-testid="vendor-name-input"]');
    this.customerNameInput = page.locator('[data-testid="customer-name-input"]');
    this.invoiceDateInput = page.locator('[data-testid="invoice-date-input"]');
    this.dueDateInput = page.locator('[data-testid="due-date-input"]');
    this.paymentTermsSelect = page.locator('[data-testid="payment-terms-select"]');
    this.currencySelect = page.locator('[data-testid="currency-select"]');
    this.notesTextarea = page.locator('[data-testid="notes-textarea"]');
    
    // Line items
    this.addLineItemButton = page.locator('[data-testid="add-line-item-button"]');
    this.lineItemRows = page.locator('[data-testid="line-item-row"]');
    this.subtotalField = page.locator('[data-testid="subtotal-field"]');
    this.taxField = page.locator('[data-testid="tax-field"]');
    this.totalField = page.locator('[data-testid="total-field"]');
    
    // Actions
    this.saveButton = page.locator('[data-testid="save-button"]');
    this.saveAsDraftButton = page.locator('[data-testid="save-draft-button"]');
    this.sendButton = page.locator('[data-testid="send-button"]');
    this.cancelButton = page.locator('[data-testid="cancel-button"]');
    this.deleteButton = page.locator('[data-testid="delete-button"]');
    this.duplicateButton = page.locator('[data-testid="duplicate-button"]');
    this.printButton = page.locator('[data-testid="print-button"]');
    this.downloadPdfButton = page.locator('[data-testid="download-pdf-button"]');
    
    // View page
    this.invoiceStatus = page.locator('[data-testid="invoice-status"]');
    this.markAsPaidButton = page.locator('[data-testid="mark-paid-button"]');
    this.recordPaymentButton = page.locator('[data-testid="record-payment-button"]');
    this.editInvoiceButton = page.locator('[data-testid="edit-invoice-button"]');
    this.sendReminderButton = page.locator('[data-testid="send-reminder-button"]');
    
    // Upload
    this.uploadDropzone = page.locator('[data-testid="upload-dropzone"]');
    this.uploadInput = page.locator('[data-testid="upload-input"]');
    this.uploadProgress = page.locator('[data-testid="upload-progress"]');
    this.uploadedFile = page.locator('[data-testid="uploaded-file"]');
  }

  // Navigation
  async gotoList() {
    await this.page.goto('/invoices');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoCreate() {
    await this.page.goto('/invoices/new');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoEdit(invoiceId: string) {
    await this.page.goto(`/invoices/${invoiceId}/edit`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoView(invoiceId: string) {
    await this.page.goto(`/invoices/${invoiceId}`);
    await this.page.waitForLoadState('networkidle');
  }

  // List page actions
  async searchInvoices(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled') {
    await this.filterButton.click();
    await this.statusFilter.selectOption(status);
    await this.page.waitForLoadState('networkidle');
  }

  async getInvoices(): Promise<Array<{
    number: string;
    vendor: string;
    customer: string;
    amount: string;
    status: string;
    date: string;
  }>> {
    const rows = await this.invoiceRows.all();
    const invoices = [];
    
    for (const row of rows) {
      invoices.push({
        number: await row.locator('[data-testid="invoice-number"]').textContent() || '',
        vendor: await row.locator('[data-testid="invoice-vendor"]').textContent() || '',
        customer: await row.locator('[data-testid="invoice-customer"]').textContent() || '',
        amount: await row.locator('[data-testid="invoice-amount"]').textContent() || '',
        status: await row.locator('[data-testid="invoice-status"]').textContent() || '',
        date: await row.locator('[data-testid="invoice-date"]').textContent() || '',
      });
    }
    
    return invoices;
  }

  async selectInvoice(invoiceNumber: string) {
    const row = this.invoiceRows.filter({ hasText: invoiceNumber });
    const checkbox = row.locator('[data-testid="invoice-checkbox"]');
    await checkbox.check();
  }

  async performBulkAction(action: 'delete' | 'export' | 'markPaid' | 'sendReminder') {
    await this.bulkActionsMenu.click();
    await this.page.locator(`[data-testid="bulk-action-${action}"]`).click();
  }

  // Form actions
  async fillInvoiceForm(data: {
    invoiceNumber?: string;
    vendorName?: string;
    customerName?: string;
    invoiceDate?: string;
    dueDate?: string;
    paymentTerms?: string;
    currency?: string;
    notes?: string;
  }) {
    if (data.invoiceNumber) await this.invoiceNumberInput.fill(data.invoiceNumber);
    if (data.vendorName) await this.vendorNameInput.fill(data.vendorName);
    if (data.customerName) await this.customerNameInput.fill(data.customerName);
    if (data.invoiceDate) await this.invoiceDateInput.fill(data.invoiceDate);
    if (data.dueDate) await this.dueDateInput.fill(data.dueDate);
    if (data.paymentTerms) await this.paymentTermsSelect.selectOption(data.paymentTerms);
    if (data.currency) await this.currencySelect.selectOption(data.currency);
    if (data.notes) await this.notesTextarea.fill(data.notes);
  }

  async addLineItem(data: {
    description: string;
    quantity: string;
    rate: string;
    tax?: string;
  }) {
    await this.addLineItemButton.click();
    
    const newRow = this.lineItemRows.last();
    await newRow.locator('[data-testid="item-description"]').fill(data.description);
    await newRow.locator('[data-testid="item-quantity"]').fill(data.quantity);
    await newRow.locator('[data-testid="item-rate"]').fill(data.rate);
    if (data.tax) {
      await newRow.locator('[data-testid="item-tax"]').fill(data.tax);
    }
  }

  async removeLineItem(index: number) {
    const rows = await this.lineItemRows.all();
    if (rows[index]) {
      await rows[index].locator('[data-testid="remove-item-button"]').click();
    }
  }

  async getTotal(): Promise<string> {
    return await this.totalField.textContent() || '';
  }

  async saveInvoice() {
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async saveAsDraft() {
    await this.saveAsDraftButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async sendInvoice() {
    await this.sendButton.click();
    // Handle send modal if present
  }

  // View page actions
  async getInvoiceStatus(): Promise<string> {
    return await this.invoiceStatus.textContent() || '';
  }

  async markAsPaid() {
    await this.markAsPaidButton.click();
    // Handle confirmation if needed
  }

  async recordPayment(amount: string, date: string, method?: string) {
    await this.recordPaymentButton.click();
    
    // Fill payment modal
    await this.page.locator('[data-testid="payment-amount"]').fill(amount);
    await this.page.locator('[data-testid="payment-date"]').fill(date);
    if (method) {
      await this.page.locator('[data-testid="payment-method"]').selectOption(method);
    }
    
    await this.page.locator('[data-testid="confirm-payment-button"]').click();
  }

  async editInvoice() {
    await this.editInvoiceButton.click();
    await this.page.waitForURL(/\/invoices\/.*\/edit/);
  }

  async deleteInvoice() {
    await this.deleteButton.click();
    
    // Handle confirmation dialog
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
    await this.page.waitForURL('/invoices');
  }

  // Upload functionality
  async uploadInvoiceFile(filePath: string) {
    await this.uploadInput.setInputFiles(filePath);
    await this.uploadProgress.waitFor({ state: 'hidden' });
  }

  async dragAndDropFile(filePath: string) {
    // Create a DataTransfer to hold the file
    const buffer = await this.page.evaluateHandle(async (filePath) => {
      const response = await fetch(filePath);
      return await response.arrayBuffer();
    }, filePath);

    // Simulate drag and drop
    await this.uploadDropzone.dispatchEvent('drop', {
      dataTransfer: {
        files: [new File([buffer], 'invoice.pdf', { type: 'application/pdf' })],
      },
    });
  }

  // Utility methods
  async waitForInvoiceSaved() {
    await this.page.waitForURL(/\/invoices\/[^\/]+$/);
    await this.page.waitForSelector('[data-testid="invoice-saved-toast"]');
  }

  async getFieldError(field: string): Promise<string> {
    const errorElement = this.page.locator(`[data-testid="${field}-error"]`);
    if (await errorElement.isVisible()) {
      return await errorElement.textContent() || '';
    }
    return '';
  }

  async isFormValid(): Promise<boolean> {
    const errors = await this.page.locator('[data-testid$="-error"]').count();
    return errors === 0;
  }
}