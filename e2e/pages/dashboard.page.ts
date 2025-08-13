import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  
  // Header elements
  readonly userMenu: Locator;
  readonly notificationBell: Locator;
  readonly searchBar: Locator;
  readonly logo: Locator;
  
  // Navigation elements
  readonly navDashboard: Locator;
  readonly navInvoices: Locator;
  readonly navCustomers: Locator;
  readonly navReports: Locator;
  readonly navSettings: Locator;
  
  // Dashboard widgets
  readonly totalRevenueWidget: Locator;
  readonly pendingInvoicesWidget: Locator;
  readonly overdueInvoicesWidget: Locator;
  readonly recentActivityWidget: Locator;
  
  // Quick actions
  readonly createInvoiceButton: Locator;
  readonly uploadInvoiceButton: Locator;
  readonly viewAllInvoicesLink: Locator;
  
  // Charts and graphs
  readonly revenueChart: Locator;
  readonly invoiceStatusChart: Locator;
  
  // Recent invoices table
  readonly recentInvoicesTable: Locator;
  readonly invoiceRows: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Header
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.notificationBell = page.locator('[data-testid="notification-bell"]');
    this.searchBar = page.locator('[data-testid="search-bar"]');
    this.logo = page.locator('[data-testid="app-logo"]');
    
    // Navigation
    this.navDashboard = page.locator('[data-testid="nav-dashboard"]');
    this.navInvoices = page.locator('[data-testid="nav-invoices"]');
    this.navCustomers = page.locator('[data-testid="nav-customers"]');
    this.navReports = page.locator('[data-testid="nav-reports"]');
    this.navSettings = page.locator('[data-testid="nav-settings"]');
    
    // Widgets
    this.totalRevenueWidget = page.locator('[data-testid="widget-total-revenue"]');
    this.pendingInvoicesWidget = page.locator('[data-testid="widget-pending-invoices"]');
    this.overdueInvoicesWidget = page.locator('[data-testid="widget-overdue-invoices"]');
    this.recentActivityWidget = page.locator('[data-testid="widget-recent-activity"]');
    
    // Quick actions
    this.createInvoiceButton = page.locator('[data-testid="create-invoice-button"]');
    this.uploadInvoiceButton = page.locator('[data-testid="upload-invoice-button"]');
    this.viewAllInvoicesLink = page.locator('[data-testid="view-all-invoices-link"]');
    
    // Charts
    this.revenueChart = page.locator('[data-testid="revenue-chart"]');
    this.invoiceStatusChart = page.locator('[data-testid="invoice-status-chart"]');
    
    // Recent invoices
    this.recentInvoicesTable = page.locator('[data-testid="recent-invoices-table"]');
    this.invoiceRows = page.locator('[data-testid="invoice-row"]');
  }

  // Navigation methods
  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageLoad() {
    await this.totalRevenueWidget.waitFor({ state: 'visible' });
  }

  // Navigation actions
  async navigateTo(section: 'dashboard' | 'invoices' | 'customers' | 'reports' | 'settings') {
    const navMap = {
      dashboard: this.navDashboard,
      invoices: this.navInvoices,
      customers: this.navCustomers,
      reports: this.navReports,
      settings: this.navSettings,
    };
    
    await navMap[section].click();
    await this.page.waitForLoadState('networkidle');
  }

  // Widget methods
  async getTotalRevenue(): Promise<string> {
    const valueElement = this.totalRevenueWidget.locator('[data-testid="revenue-value"]');
    return await valueElement.textContent() || '';
  }

  async getPendingInvoicesCount(): Promise<number> {
    const countElement = this.pendingInvoicesWidget.locator('[data-testid="pending-count"]');
    const text = await countElement.textContent() || '0';
    return parseInt(text, 10);
  }

  async getOverdueInvoicesCount(): Promise<number> {
    const countElement = this.overdueInvoicesWidget.locator('[data-testid="overdue-count"]');
    const text = await countElement.textContent() || '0';
    return parseInt(text, 10);
  }

  // Quick actions
  async createNewInvoice() {
    await this.createInvoiceButton.click();
    await this.page.waitForURL('/invoices/new');
  }

  async uploadInvoice() {
    await this.uploadInvoiceButton.click();
    // Wait for upload modal or navigate to upload page
  }

  async viewAllInvoices() {
    await this.viewAllInvoicesLink.click();
    await this.page.waitForURL('/invoices');
  }

  // Search functionality
  async searchFor(query: string) {
    await this.searchBar.fill(query);
    await this.searchBar.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async clearSearch() {
    await this.searchBar.clear();
    await this.searchBar.press('Enter');
  }

  // User menu actions
  async openUserMenu() {
    await this.userMenu.click();
  }

  async selectUserMenuOption(option: 'profile' | 'settings' | 'logout') {
    await this.openUserMenu();
    const optionLocator = this.page.locator(`[data-testid="user-menu-${option}"]`);
    await optionLocator.click();
  }

  async logout() {
    await this.selectUserMenuOption('logout');
    await this.page.waitForURL('/auth/login');
  }

  // Notifications
  async openNotifications() {
    await this.notificationBell.click();
  }

  async getNotificationCount(): Promise<number> {
    const badge = this.notificationBell.locator('[data-testid="notification-count"]');
    if (await badge.isVisible()) {
      const text = await badge.textContent() || '0';
      return parseInt(text, 10);
    }
    return 0;
  }

  // Recent invoices table
  async getRecentInvoices(): Promise<Array<{
    number: string;
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
        customer: await row.locator('[data-testid="invoice-customer"]').textContent() || '',
        amount: await row.locator('[data-testid="invoice-amount"]').textContent() || '',
        status: await row.locator('[data-testid="invoice-status"]').textContent() || '',
        date: await row.locator('[data-testid="invoice-date"]').textContent() || '',
      });
    }
    
    return invoices;
  }

  async clickInvoice(invoiceNumber: string) {
    const row = this.invoiceRows.filter({ hasText: invoiceNumber });
    await row.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Chart interactions
  async isRevenueChartVisible(): Promise<boolean> {
    return await this.revenueChart.isVisible();
  }

  async getChartData(chartType: 'revenue' | 'status'): Promise<any> {
    const chart = chartType === 'revenue' ? this.revenueChart : this.invoiceStatusChart;
    
    // This would depend on how the chart is implemented
    // For example, if using a canvas-based chart library
    return await chart.evaluate((el) => {
      // Extract data from chart instance
      return (el as any).__chartData || null;
    });
  }

  // Activity feed
  async getRecentActivities(): Promise<string[]> {
    const activities = await this.recentActivityWidget
      .locator('[data-testid="activity-item"]')
      .allTextContents();
    return activities;
  }

  // Utility methods
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `screenshots/dashboard-${name}.png`,
      fullPage: true 
    });
  }

  async waitForDataToLoad() {
    // Wait for all key elements to be visible
    await Promise.all([
      this.totalRevenueWidget.waitFor({ state: 'visible' }),
      this.recentInvoicesTable.waitFor({ state: 'visible' }),
      this.revenueChart.waitFor({ state: 'visible' }),
    ]);
  }
}