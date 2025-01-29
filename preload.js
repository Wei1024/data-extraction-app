const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const keytar = require('keytar')
const path = require('path')
const { getExtractionPrompt } = require('./promptTemplates')

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

  queryPDF: async (pdfFile, queryText) => {
    try {
      // Get API key
      const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      if (!apiKey) {
        throw new Error('Please save your Anthropic API key first')
      }

      // Read the file as Buffer
      const fileBuffer = await fs.promises.readFile(pdfFile.path)
      
      // Convert buffer to base64
      const base64Pdf = fileBuffer.toString('base64')

      // Make the API request to Anthropic
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
        throw new Error(errorData.error?.message || 'API request failed')
      }

      const data = await response.json()
      return data.content[0].text
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }
})
