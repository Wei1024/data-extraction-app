const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const keytar = require('keytar')
const path = require('path')
const { getExtractionPrompt } = require('./promptTemplates')

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelay: 5000,
  maxDelay: 32000,
  backoffFactor: 2,
  jitter: true
}

// Helper function to add jitter to delay
const addJitter = (delay) => {
  if (!RETRY_CONFIG.jitter) return delay
  const jitterFactor = 0.5 + Math.random()
  return Math.floor(delay * jitterFactor)
}

// Calculate delay for retry attempt
const calculateDelay = (attempt) => {
  const delay = Math.min(
    RETRY_CONFIG.maxDelay,
    RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt)
  )
  return addJitter(delay)
}

// Check if error is retryable
const isRetryableError = (error) => {
  if (!error) return false
  
  // Rate limit errors
  if (error.message?.includes('rate limit')) return true
  
  // Network errors
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') return true
  
  // Server errors (5xx)
  if (error.status >= 500 && error.status < 600) return true
  
  return false
}

// Retry function with exponential backoff
const retryWithExponentialBackoff = async (operation, onRetry) => {
  let attempt = 0
  
  while (true) {
    try {
      return await operation()
    } catch (error) {
      attempt++
      
      if (!isRetryableError(error) || attempt >= RETRY_CONFIG.maxRetries) {
        throw error
      }
      
      const delay = calculateDelay(attempt)
      if (onRetry) {
        onRetry({
          attempt,
          maxRetries: RETRY_CONFIG.maxRetries,
          delay,
          error
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Service name for keytar
const SERVICE_NAME = 'pdf-query-app'
const ACCOUNT_NAME = 'anthropic-api-key'

contextBridge.exposeInMainWorld('api', {
  version: process.versions.node,
  
  // API Key Management
  saveApiKey: async (apiKey) => {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey)
      return true
    } catch (error) {
      console.error('Error saving API key:', error)
      throw new Error('Failed to save API key securely')
    }
  },

  getApiKey: async () => {
    try {
      return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    } catch (error) {
      console.error('Error retrieving API key:', error)
      throw new Error('Failed to retrieve API key')
    }
  },

  queryPDF: async (fileBuffer, queryText, onRetry) => {
    // Get API key
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (!apiKey) {
      throw new Error('Please save your Anthropic API key first')
    }

    // Convert ArrayBuffer to Buffer and then to base64
    const buffer = Buffer.from(fileBuffer)
    const base64Pdf = buffer.toString('base64')

    // Define the API call operation
    const makeRequest = async () => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              content: [
                {
                  type: 'document',
                  source: {
                    media_type: 'application/pdf',
                    type: 'base64',
                    data: base64Pdf,
                  },
                  cache_control: { type: 'ephemeral' },
                },
                {
                  type: 'text',
                  text: getExtractionPrompt(queryText),
                },
              ],
              role: 'user',
            },
          ],
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        const error = new Error(errorData.error?.message || 'API request failed')
        error.status = response.status
        throw error
      }

      const data = await response.json()
      
      // Calculate costs based on token usage
      const calculateCosts = (usage) => {
        const costs = {
          input: (usage.input_tokens || 0) * (3 / 1000000),
          output: (usage.output_tokens || 0) * (15 / 1000000),
          cache_read: (usage.cache_read_input_tokens || 0) * (0.30 / 1000000),
          cache_creation: (usage.cache_creation_input_tokens || 0) * (3.75 / 1000000)
        }
        
        costs.total = costs.input + costs.output + costs.cache_read + costs.cache_creation
        return costs
      }

      // Return both the API response and calculated costs
      return {
        content: data.content,
        usage: data.usage,
        costs: calculateCosts(data.usage),
        metadata: {
          id: data.id,
          model: data.model,
          role: data.role,
          stop_reason: data.stop_reason,
          stop_sequence: data.stop_sequence,
          type: data.type
        }
      }
    }

    try {
      return await retryWithExponentialBackoff(makeRequest, onRetry)
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }
})
