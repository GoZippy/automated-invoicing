import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { createBrowserClient } from '@supabase/ssr'
import { ThemeProvider } from 'next-themes'

// Create a custom render function that includes all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  // Create a new QueryClient for each test to ensure isolation
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        cacheTime: 0, // Disable cache in tests
      },
    },
  })

  // Create a mock Supabase client
  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <SessionContextProvider supabaseClient={supabaseClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SessionContextProvider>
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Helper function to create mock user
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {
    full_name: 'Test User',
  },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

// Helper function to create mock session
export const createMockSession = (overrides = {}) => ({
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  user: createMockUser(),
  ...overrides,
})

// Helper function to create mock invoice
export const createMockInvoice = (overrides = {}) => ({
  id: 'inv-123',
  invoice_number: 'INV-001',
  vendor_name: 'Test Vendor',
  customer_name: 'Test Customer',
  total_amount: 1000,
  status: 'pending',
  invoice_date: '2024-01-15',
  due_date: '2024-02-15',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

// Helper function to wait for async updates
export const waitForLoadingToFinish = () =>
  waitFor(() => {
    const loadingElements = [
      ...screen.queryAllByText(/loading/i),
      ...screen.queryAllByTestId('skeleton'),
    ]
    expect(loadingElements).toHaveLength(0)
  })

// Helper to mock fetch responses
export const mockFetch = (response: any, options = {}) => {
  return (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => response,
    ...options,
  })
}

// Helper to mock fetch error
export const mockFetchError = (status = 500, message = 'Internal Server Error') => {
  return (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: { message } }),
  })
}

import { screen, waitFor } from '@testing-library/react'