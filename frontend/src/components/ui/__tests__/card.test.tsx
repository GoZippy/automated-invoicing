import React from 'react'
import { render, screen } from '@/test-utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card container', () => {
      render(
        <Card data-testid="card">
          <div>Card content</div>
        </Card>
      )
      
      const card = screen.getByTestId('card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'shadow-sm')
    })

    it('applies custom className', () => {
      render(
        <Card className="custom-card" data-testid="card">
          Content
        </Card>
      )
      
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-card')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(
        <Card ref={ref}>
          Card with ref
        </Card>
      )
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('passes through additional props', () => {
      render(
        <Card data-custom="value" aria-label="Custom card">
          Content
        </Card>
      )
      
      const card = screen.getByLabelText('Custom card')
      expect(card).toHaveAttribute('data-custom', 'value')
    })
  })

  describe('CardHeader', () => {
    it('renders card header', () => {
      render(
        <Card>
          <CardHeader data-testid="header">
            <div>Header content</div>
          </CardHeader>
        </Card>
      )
      
      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
    })

    it('applies custom className to header', () => {
      render(
        <Card>
          <CardHeader className="custom-header" data-testid="header">
            Header
          </CardHeader>
        </Card>
      )
      
      const header = screen.getByTestId('header')
      expect(header).toHaveClass('custom-header')
    })
  })

  describe('CardTitle', () => {
    it('renders card title as h3', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
        </Card>
      )
      
      const title = screen.getByRole('heading', { name: 'Invoice Details', level: 3 })
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight')
    })

    it('applies custom className to title', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Custom Title</CardTitle>
          </CardHeader>
        </Card>
      )
      
      const title = screen.getByRole('heading', { name: 'Custom Title' })
      expect(title).toHaveClass('text-primary')
    })
  })

  describe('CardDescription', () => {
    it('renders card description', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>View and manage your invoice</CardDescription>
          </CardHeader>
        </Card>
      )
      
      const description = screen.getByText('View and manage your invoice')
      expect(description).toBeInTheDocument()
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('applies custom className to description', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription className="text-xs">Small description</CardDescription>
          </CardHeader>
        </Card>
      )
      
      const description = screen.getByText('Small description')
      expect(description).toHaveClass('text-xs')
    })
  })

  describe('CardContent', () => {
    it('renders card content', () => {
      render(
        <Card>
          <CardContent data-testid="content">
            <p>Main content goes here</p>
          </CardContent>
        </Card>
      )
      
      const content = screen.getByTestId('content')
      expect(content).toBeInTheDocument()
      expect(content).toHaveClass('p-6', 'pt-0')
    })

    it('applies custom className to content', () => {
      render(
        <Card>
          <CardContent className="space-y-4" data-testid="content">
            Content with spacing
          </CardContent>
        </Card>
      )
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('space-y-4')
    })
  })

  describe('CardFooter', () => {
    it('renders card footer', () => {
      render(
        <Card>
          <CardFooter data-testid="footer">
            <button>Save</button>
          </CardFooter>
        </Card>
      )
      
      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })

    it('applies custom className to footer', () => {
      render(
        <Card>
          <CardFooter className="justify-end" data-testid="footer">
            Footer actions
          </CardFooter>
        </Card>
      )
      
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('justify-end')
    })
  })

  describe('Complete Card Example', () => {
    it('renders a complete card with all components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Invoice #INV-001</CardTitle>
            <CardDescription>Created on January 15, 2024</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Customer: ABC Company</p>
              <p>Amount: $1,000.00</p>
              <p>Status: Pending</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <button>Edit</button>
            <button>Send</button>
          </CardFooter>
        </Card>
      )
      
      // Check all elements are rendered
      expect(screen.getByRole('heading', { name: 'Invoice #INV-001' })).toBeInTheDocument()
      expect(screen.getByText('Created on January 15, 2024')).toBeInTheDocument()
      expect(screen.getByText('Customer: ABC Company')).toBeInTheDocument()
      expect(screen.getByText('Amount: $1,000.00')).toBeInTheDocument()
      expect(screen.getByText('Status: Pending')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Send')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('supports ARIA attributes', () => {
      render(
        <Card role="article" aria-label="Invoice card">
          <CardHeader>
            <CardTitle id="card-title">Invoice</CardTitle>
            <CardDescription id="card-desc">Invoice details</CardDescription>
          </CardHeader>
          <CardContent aria-labelledby="card-title" aria-describedby="card-desc">
            Content
          </CardContent>
        </Card>
      )
      
      const card = screen.getByRole('article', { name: 'Invoice card' })
      expect(card).toBeInTheDocument()
      
      const content = screen.getByText('Content')
      expect(content.parentElement).toHaveAttribute('aria-labelledby', 'card-title')
      expect(content.parentElement).toHaveAttribute('aria-describedby', 'card-desc')
    })
  })

  describe('Nested Cards', () => {
    it('can render nested cards', () => {
      render(
        <Card data-testid="parent-card">
          <CardHeader>
            <CardTitle>Parent Card</CardTitle>
          </CardHeader>
          <CardContent>
            <Card data-testid="child-card">
              <CardHeader>
                <CardTitle>Child Card</CardTitle>
              </CardHeader>
              <CardContent>Nested content</CardContent>
            </Card>
          </CardContent>
        </Card>
      )
      
      expect(screen.getByTestId('parent-card')).toBeInTheDocument()
      expect(screen.getByTestId('child-card')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Parent Card' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Child Card' })).toBeInTheDocument()
    })
  })
})