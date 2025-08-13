import OpenAI from 'openai';
import { logger } from '../utils/logger';

let openaiClient: OpenAI | null = null;

export const initializeOpenAI = () => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.warn('OpenAI API key not found in environment variables');
      return;
    }

    openaiClient = new OpenAI({
      apiKey,
      maxRetries: 3,
      timeout: 30000, // 30 seconds
    });

    logger.info('OpenAI client initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize OpenAI:', error);
    throw error;
  }
};

export const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Call initializeOpenAI() first.');
  }
  return openaiClient;
};

// Invoice extraction prompt template
export const INVOICE_EXTRACTION_PROMPT = `
You are an AI assistant specialized in extracting information from invoices. 
Extract the following information from the provided invoice text and return it in a structured JSON format:

{
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "vendor": {
    "name": "string",
    "address": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "tax_id": "string or null"
  },
  "customer": {
    "name": "string",
    "address": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "tax_id": "string or null"
  },
  "line_items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "unit": "string",
      "tax_rate": number,
      "tax_amount": number,
      "discount_rate": number,
      "discount_amount": number,
      "sku": "string or null"
    }
  ],
  "payment_terms": "string or null",
  "notes": "string or null",
  "currency": "3-letter currency code",
  "tax_rate": number,
  "tax_amount": number,
  "discount_rate": number,
  "discount_amount": number,
  "shipping_amount": number,
  "subtotal": number,
  "total_amount": number
}

If any field cannot be determined from the invoice, use null.
For dates, use YYYY-MM-DD format.
For currency, use standard 3-letter codes (USD, EUR, GBP, etc.).
Calculate totals if they're not explicitly stated.
`;

// Natural language query prompt template
export const NATURAL_LANGUAGE_QUERY_PROMPT = `
You are an AI assistant for an intelligent invoicing system. You help users query and manage their invoices using natural language.

Available operations:
1. Search invoices by various criteria (date, amount, customer, vendor, status)
2. Get invoice statistics and summaries
3. Find overdue invoices
4. Calculate revenue for periods
5. Get payment status updates
6. Analyze invoice trends

Based on the user's query, determine:
1. The intended operation
2. Required parameters
3. Any filters to apply

Return a structured response that can be used to query the database.

User query: {query}

Respond with a JSON object containing:
{
  "operation": "search_invoices" | "get_statistics" | "find_overdue" | "calculate_revenue" | "get_payment_status" | "analyze_trends",
  "parameters": {
    // Relevant parameters based on operation
  },
  "filters": {
    // Any filters to apply
  },
  "natural_response": "A natural language response to show the user"
}
`;

// Invoice validation prompt template
export const INVOICE_VALIDATION_PROMPT = `
You are an AI assistant that validates invoice data for accuracy and completeness.

Review the following invoice data and identify:
1. Missing required fields
2. Potential errors or inconsistencies
3. Unusual values that might need verification
4. Calculation errors

Invoice data:
{invoice_data}

Return a JSON object with:
{
  "is_valid": boolean,
  "errors": [
    {
      "field": "string",
      "message": "string",
      "severity": "error" | "warning" | "info"
    }
  ],
  "suggestions": [
    {
      "field": "string",
      "suggestion": "string"
    }
  ],
  "confidence_score": number (0-1)
}
`;

// Helper function to create chat completions
export const createChatCompletion = async (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  }
) => {
  const client = getOpenAIClient();
  
  try {
    const response = await client.chat.completions.create({
      model: options?.model || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      temperature: options?.temperature || 0.3,
      max_tokens: options?.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
      response_format: options?.response_format,
    });

    return response;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw error;
  }
};

// Helper function for invoice extraction
export const extractInvoiceData = async (invoiceText: string) => {
  const messages = [
    {
      role: 'system' as const,
      content: INVOICE_EXTRACTION_PROMPT,
    },
    {
      role: 'user' as const,
      content: `Extract information from this invoice:\n\n${invoiceText}`,
    },
  ];

  const response = await createChatCompletion(messages, {
    response_format: { type: 'json_object' },
    temperature: 0.1, // Low temperature for consistent extraction
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
};

// Helper function for natural language queries
export const processNaturalLanguageQuery = async (query: string, context?: any) => {
  const messages = [
    {
      role: 'system' as const,
      content: NATURAL_LANGUAGE_QUERY_PROMPT,
    },
    {
      role: 'user' as const,
      content: query,
    },
  ];

  if (context) {
    messages.push({
      role: 'system' as const,
      content: `Additional context: ${JSON.stringify(context)}`,
    });
  }

  const response = await createChatCompletion(messages, {
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
};

// Helper function for invoice validation
export const validateInvoiceData = async (invoiceData: any) => {
  const messages = [
    {
      role: 'system' as const,
      content: INVOICE_VALIDATION_PROMPT,
    },
    {
      role: 'user' as const,
      content: JSON.stringify(invoiceData, null, 2),
    },
  ];

  const response = await createChatCompletion(messages, {
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
};