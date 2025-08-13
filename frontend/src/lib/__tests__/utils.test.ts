import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getInitials,
  truncate,
  debounce,
  getErrorMessage,
} from '../utils'

describe('Utility Functions', () => {
  describe('cn (classnames)', () => {
    it('combines multiple class names', () => {
      const result = cn('btn', 'btn-primary', 'active')
      expect(result).toBe('btn btn-primary active')
    })

    it('handles conditional classes with clsx', () => {
      const result = cn('btn', {
        'btn-primary': true,
        'btn-secondary': false,
      })
      expect(result).toBe('btn btn-primary')
    })

    it('merges tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4')
      expect(result).toBe('py-1 px-4') // tailwind-merge should override px-2 with px-4
    })

    it('handles arrays of classes', () => {
      const result = cn(['btn', 'btn-primary'], 'active')
      expect(result).toBe('btn btn-primary active')
    })

    it('filters out falsy values', () => {
      const result = cn('btn', null, undefined, '', false, 'active')
      expect(result).toBe('btn active')
    })
  })

  describe('formatCurrency', () => {
    it('formats basic amounts', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00')
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('handles different currencies', () => {
      expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00')
      expect(formatCurrency(1000, 'GBP')).toBe('£1,000.00')
      expect(formatCurrency(1000, 'JPY')).toBe('¥1,000')
    })

    it('handles different locales', () => {
      expect(formatCurrency(1000, 'EUR', 'de-DE')).toBe('1.000,00 €')
      expect(formatCurrency(1000, 'USD', 'fr-FR')).toBe('1 000,00 $US')
    })

    it('handles negative amounts', () => {
      expect(formatCurrency(-1000)).toBe('-$1,000.00')
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
    })

    it('handles very large numbers', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00')
      expect(formatCurrency(1234567890.12)).toBe('$1,234,567,890.12')
    })

    it('rounds to 2 decimal places for most currencies', () => {
      expect(formatCurrency(10.999)).toBe('$11.00')
      expect(formatCurrency(10.994)).toBe('$10.99')
    })
  })

  describe('formatDate', () => {
    it('formats date strings', () => {
      const date = '2024-01-15'
      expect(formatDate(date)).toBe('Jan 15, 2024')
    })

    it('formats Date objects', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date)).toBe('Jan 15, 2024')
    })

    it('formats with different formats', () => {
      const date = '2024-01-15'
      expect(formatDate(date, 'long')).toBe('January 15, 2024')
      expect(formatDate(date, 'short')).toBe('1/15/24')
    })

    it('handles different locales', () => {
      const date = '2024-01-15'
      expect(formatDate(date, 'medium', 'en-GB')).toBe('15 Jan 2024')
      expect(formatDate(date, 'medium', 'de-DE')).toBe('15. Jan. 2024')
    })

    it('handles invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date')
      expect(formatDate('')).toBe('Invalid Date')
    })

    it('handles null and undefined', () => {
      expect(formatDate(null as any)).toBe('Invalid Date')
      expect(formatDate(undefined as any)).toBe('Invalid Date')
    })
  })

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15 12:00:00'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('formats past dates', () => {
      expect(formatRelativeTime('2024-01-15 11:59:00')).toBe('1 minute ago')
      expect(formatRelativeTime('2024-01-15 10:00:00')).toBe('2 hours ago')
      expect(formatRelativeTime('2024-01-14 12:00:00')).toBe('yesterday')
      expect(formatRelativeTime('2024-01-08 12:00:00')).toBe('last week')
      expect(formatRelativeTime('2023-12-15 12:00:00')).toBe('last month')
      expect(formatRelativeTime('2023-01-15 12:00:00')).toBe('last year')
    })

    it('formats future dates', () => {
      expect(formatRelativeTime('2024-01-15 12:01:00')).toBe('in 1 minute')
      expect(formatRelativeTime('2024-01-15 14:00:00')).toBe('in 2 hours')
      expect(formatRelativeTime('2024-01-16 12:00:00')).toBe('tomorrow')
      expect(formatRelativeTime('2024-01-22 12:00:00')).toBe('next week')
      expect(formatRelativeTime('2024-02-15 12:00:00')).toBe('next month')
      expect(formatRelativeTime('2025-01-15 12:00:00')).toBe('next year')
    })

    it('formats "now" for very recent times', () => {
      expect(formatRelativeTime('2024-01-15 12:00:00')).toBe('now')
      expect(formatRelativeTime('2024-01-15 11:59:31')).toBe('now') // within 30 seconds
    })

    it('handles different locales', () => {
      expect(formatRelativeTime('2024-01-14 12:00:00', 'es')).toBe('ayer')
      expect(formatRelativeTime('2024-01-14 12:00:00', 'fr')).toBe('hier')
    })
  })

  describe('getInitials', () => {
    it('gets initials from names', () => {
      expect(getInitials('John Doe')).toBe('JD')
      expect(getInitials('Jane Smith')).toBe('JS')
      expect(getInitials('John')).toBe('J')
    })

    it('handles multiple names', () => {
      expect(getInitials('John Michael Doe')).toBe('JD')
      expect(getInitials('Mary Jane Watson Parker')).toBe('MP')
    })

    it('handles empty or invalid input', () => {
      expect(getInitials('')).toBe('')
      expect(getInitials(' ')).toBe('')
      expect(getInitials(null as any)).toBe('')
      expect(getInitials(undefined as any)).toBe('')
    })

    it('handles special characters', () => {
      expect(getInitials('Jean-Pierre Dupont')).toBe('JD')
      expect(getInitials("O'Brien")).toBe('O')
    })

    it('converts to uppercase', () => {
      expect(getInitials('john doe')).toBe('JD')
      expect(getInitials('JOHN DOE')).toBe('JD')
    })
  })

  describe('truncate', () => {
    it('truncates long strings', () => {
      const text = 'This is a very long string that should be truncated'
      expect(truncate(text, 20)).toBe('This is a very long...')
    })

    it('does not truncate short strings', () => {
      const text = 'Short string'
      expect(truncate(text, 20)).toBe('Short string')
    })

    it('handles exact length', () => {
      const text = 'Exactly twenty chars'
      expect(truncate(text, 20)).toBe('Exactly twenty chars')
    })

    it('handles custom suffix', () => {
      const text = 'This is a very long string'
      expect(truncate(text, 15, '…')).toBe('This is a very…')
      expect(truncate(text, 15, ' [more]')).toBe('This is a [more]')
    })

    it('handles empty or invalid input', () => {
      expect(truncate('', 10)).toBe('')
      expect(truncate(null as any, 10)).toBe('')
      expect(truncate(undefined as any, 10)).toBe('')
    })

    it('handles zero or negative length', () => {
      expect(truncate('Hello', 0)).toBe('...')
      expect(truncate('Hello', -5)).toBe('...')
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('debounces function calls', () => {
      const fn = jest.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')

      expect(fn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('third')
    })

    it('can be called multiple times with delays', () => {
      const fn = jest.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('first')
      jest.advanceTimersByTime(50)
      debouncedFn('second')
      jest.advanceTimersByTime(50)
      debouncedFn('third')
      jest.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('third')
    })

    it('preserves this context', () => {
      const obj = {
        value: 'test',
        method: jest.fn(function(this: any) {
          return this.value
        }),
      }

      obj.method = debounce(obj.method, 100)
      obj.method()

      jest.advanceTimersByTime(100)

      expect(obj.method).toHaveReturnedWith('test')
    })

    it('passes all arguments', () => {
      const fn = jest.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1', 'arg2', { key: 'value' })
      jest.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' })
    })
  })

  describe('getErrorMessage', () => {
    it('extracts message from Error objects', () => {
      const error = new Error('Something went wrong')
      expect(getErrorMessage(error)).toBe('Something went wrong')
    })

    it('extracts message from error-like objects', () => {
      const error = { message: 'Custom error message' }
      expect(getErrorMessage(error)).toBe('Custom error message')
    })

    it('converts strings to error messages', () => {
      expect(getErrorMessage('String error')).toBe('String error')
    })

    it('handles null and undefined', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred')
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred')
    })

    it('handles non-standard errors', () => {
      expect(getErrorMessage(123)).toBe('An unknown error occurred')
      expect(getErrorMessage({})).toBe('An unknown error occurred')
      expect(getErrorMessage([])).toBe('An unknown error occurred')
    })

    it('handles nested error objects', () => {
      const error = {
        response: {
          data: {
            message: 'Server error message',
          },
        },
      }
      expect(getErrorMessage(error)).toBe('Server error message')
    })

    it('prioritizes error.message over nested messages', () => {
      const error = {
        message: 'Top level message',
        response: {
          data: {
            message: 'Nested message',
          },
        },
      }
      expect(getErrorMessage(error)).toBe('Top level message')
    })
  })
})