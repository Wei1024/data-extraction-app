const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const keytar = require('keytar')
const path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const { getExtractionPrompt } = require('./promptTemplates')

// Store for batch jobs with enhanced tracking
const batchJobs = new Map()

// Constants for batch processing
const BATCH_CONSTANTS = {
  MAX_BATCH_SIZE: 256 * 1024 * 1024, // 256MB
  EXPIRATION_DAYS: 29,
  CACHE_LIFETIME: 5 * 60 * 1000, // 5 minutes in milliseconds
  STREAM_CHUNK_SIZE: 1024 * 1024 // 1MB chunks for streaming
}

// Helper to check if batch size exceeds limit
const calculateBatchSize = (requests) => {
  return new Blob([JSON.stringify({ requests })]).size
}


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
  constants: BATCH_CONSTANTS,
  
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

  // Regular single query
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
  },

  // Enhanced batch query submission
  submitBatchQuery: async (files, topics, options = {}) => {
    // Get API key
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (!apiKey) {
      throw new Error('Please save your Anthropic API key first')
    }

    const requests = []
    let totalSize = 0
    
    // Prepare batch requests
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64Pdf = buffer.toString('base64')
      
      for (const topic of topics) {
        const customId = `${file.name}-${topic.name}`.replace(/[^a-zA-Z0-9-_]/g, '_')
        const request = {
          custom_id: customId,
          params: {
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
                    cache_control: options.enableCaching ? { type: 'ephemeral' } : undefined,
                  },
                  {
                    type: 'text',
                    text: getExtractionPrompt(topic.query),
                  },
                ],
                role: 'user',
              },
            ],
            model: 'claude-3-5-sonnet-20241022',
          },
        }

        // Check batch size limit
        const requestSize = new Blob([JSON.stringify(request)]).size
        if (totalSize + requestSize > BATCH_CONSTANTS.MAX_BATCH_SIZE) {
          throw new Error('Batch size would exceed 256MB limit. Please reduce the number of files or split into multiple batches.')
        }
        
        totalSize += requestSize
        requests.push(request)
      }
    }

    // Submit batch request
    const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ requests })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Batch submission failed')
    }

    const data = await response.json()
    
    // Store batch job with enhanced tracking
    const batchJob = {
      id: data.id,
      type: data.type,
      processing_status: data.processing_status,
      request_counts: data.request_counts,
      created_at: data.created_at,
      expires_at: data.expires_at,
      ended_at: data.ended_at,
      cancel_initiated_at: data.cancel_initiated_at,
      results_url: data.results_url,
      files: files.map(f => f.name),
      topics: topics.map(t => t.name),
      results: null,
      error: null,
      cache_stats: {
        hits: 0,
        misses: 0,
        hit_rate: 0
      }
    }
    
    batchJobs.set(data.id, batchJob)
    
    return batchJob
  },

  // Enhanced batch job status retrieval
  getBatchJobStatus: async (batchId) => {
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (!apiKey) {
      throw new Error('Please save your Anthropic API key first')
    }

    const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to get batch status')
    }

    const data = await response.json()
    
    // Update stored job with enhanced tracking
    const job = batchJobs.get(batchId)
    if (job) {
      job.processing_status = data.processing_status
      job.request_counts = data.request_counts
      job.ended_at = data.ended_at
      job.results_url = data.results_url
      
      if (data.processing_status === 'ended') {
        try {
          // Stream results through main process
          const results = await ipcRenderer.invoke('stream-batch-results', batchId)
          let totalTokens = { input: 0, output: 0 }
          let stats = {
            cacheHits: 0,
            succeeded: 0,
            errored: 0,
            canceled: 0,
            expired: 0
          }

          // Process results
          for (const result of results) {
            if (!result?.result?.type) {
              console.error('Invalid result structure:', result)
              continue
            }

            switch (result.result.type) {
              case 'succeeded':
                if (result.result?.message?.usage) {
                  totalTokens.input += result.result.message.usage.input_tokens || 0
                  totalTokens.output += result.result.message.usage.output_tokens || 0
                  // Track cache hits
                  if (result.result.message.usage.cache_hit) {
                    stats.cacheHits++
                  }
                }
                stats.succeeded++
                break

              case 'errored':
                const error = result.result.error
                if (error.type === "invalid_request") {
                  // Request body must be fixed before re-sending
                  job.error = `Validation error for ${result.custom_id}: ${error.message}`
                } else {
                  // Server error that can be retried
                  job.error = `Server error for ${result.custom_id}: ${error.message}`
                }
                stats.errored++
                break

              case 'canceled':
                stats.canceled++
                break

              case 'expired':
                stats.expired++
                break

              default:
                console.error('Unknown result type:', result.result.type)
            }
          }

          const totalRequests = stats.succeeded + stats.errored + stats.canceled + stats.expired
          
          job.results = results.filter(r => r.result.type === 'succeeded')
          job.cache_stats = {
            hits: stats.cacheHits,
            misses: stats.succeeded - stats.cacheHits,
            hit_rate: stats.succeeded > 0 ? (stats.cacheHits / stats.succeeded) * 100 : 0,
            succeeded: stats.succeeded,
            errored: stats.errored,
            canceled: stats.canceled,
            expired: stats.expired,
            total: totalRequests
          }
          
          // Calculate costs with cache consideration
          const regularCost = {
            input: (totalTokens.input * 1.5) / 1000000,
            output: (totalTokens.output * 7.5) / 1000000
          }
          regularCost.total = regularCost.input + regularCost.output
          
          const cachedCost = {
            input: (stats.cacheHits * (totalTokens.input / totalRequests) * 0.15) / 1000000, // 90% discount
            output: (stats.cacheHits * (totalTokens.output / totalRequests) * 0.75) / 1000000 // 90% discount
          }
          cachedCost.total = cachedCost.input + cachedCost.output
          
          job.costs = {
            regular: regularCost,
            cached: cachedCost,
            total: regularCost.total + cachedCost.total,
            savings: regularCost.total - cachedCost.total
          }
        } catch (error) {
          job.error = `Error processing results: ${error.message}`
        }
      }
      
      batchJobs.set(batchId, job)
    }

    return job
  },

  // Enhanced batch jobs listing with filtering and sorting
  listBatchJobs: (options = {}) => {
    let jobs = Array.from(batchJobs.values())
    
    // Filter by status if specified
    if (options.status) {
      jobs = jobs.filter(job => job.processing_status === options.status)
    }
    
    // Filter out expired jobs
    if (!options.includeExpired) {
      const now = new Date()
      jobs = jobs.filter(job => {
        const expirationDate = new Date(job.created_at)
        expirationDate.setDate(expirationDate.getDate() + BATCH_CONSTANTS.EXPIRATION_DAYS)
        return now < expirationDate
      })
    }
    
    // Sort by creation date (newest first)
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    return jobs
  },

  // Cancel a batch job
  cancelBatchJob: async (batchId) => {
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (!apiKey) {
      throw new Error('Please save your Anthropic API key first')
    }

    const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}/cancel`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to cancel batch')
    }

    const job = batchJobs.get(batchId)
    if (job) {
      job.cancel_initiated_at = new Date().toISOString()
      batchJobs.set(batchId, job)
    }

    return job
  }
})
