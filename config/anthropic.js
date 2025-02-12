// Anthropic API Configuration

// Model Configuration
const MODEL_CONFIG = {
    name: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    api_version: '2023-06-01'
}

// Cost Configuration (per million tokens)
const COST_CONFIG = {
    regular: {
        input: {
            rate: 3.00,  // $3.00 per million tokens
            per_token: 3 / 1000000
        },
        output: {
            rate: 15.00,  // $15.00 per million tokens
            per_token: 15 / 1000000
        }
    },
    batch: {
        input: {
            rate: 1.50,  // $1.50 per million tokens (50% of regular)
            per_token: 1.5 / 1000000
        },
        output: {
            rate: 7.50,  // $7.50 per million tokens (50% of regular)
            per_token: 7.5 / 1000000
        }
    },
    cache: {
        read: {
            rate: 0.30,  // $0.30 per million tokens (90% discount)
            per_token: 0.30 / 1000000
        },
        creation: {
            rate: 3.75,  // $3.75 per million tokens
            per_token: 3.75 / 1000000
        }
    }
}

// Batch Processing Configuration
const BATCH_CONFIG = {
    MAX_BATCH_SIZE: 256 * 1024 * 1024, // 256MB
    EXPIRATION_DAYS: 29,
    CACHE_LIFETIME: 5 * 60 * 1000, // 5 minutes in milliseconds
    STREAM_CHUNK_SIZE: 1024 * 1024 // 1MB chunks for streaming
}

// API Endpoints
const API_ENDPOINTS = {
    messages: 'https://api.anthropic.com/v1/messages',
    batches: 'https://api.anthropic.com/v1/messages/batches',
    batchResults: (batchId) => `https://api.anthropic.com/v1/messages/batches/${batchId}`,
    batchCancel: (batchId) => `https://api.anthropic.com/v1/messages/batches/${batchId}/cancel`
}

module.exports = {
    MODEL_CONFIG,
    COST_CONFIG,
    BATCH_CONFIG,
    API_ENDPOINTS
} 