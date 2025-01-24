const { contextBridge } = require('electron')
const fs = require('fs')

contextBridge.exposeInMainWorld('api', {
  version: process.versions.node,
  queryPDF: async (pdfFile, queryText) => {
    try {
      // Read the file as Buffer
      const fileBuffer = await fs.promises.readFile(pdfFile.path)
      
      // Create form data
      const formData = new FormData()
      
      // Create a Blob from the buffer
      const blob = new Blob([fileBuffer], { type: 'application/pdf' })
      
      // Create a File object from the Blob
      const file = new File([blob], pdfFile.name, { type: 'application/pdf' })
      
      // Append file and query to FormData
      formData.append('pdf_file', file)
      formData.append('query_text', queryText)

      // Make the API request using browser's fetch
      const response = await fetch('http://localhost:8000/query-pdf/', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'API request failed')
      }

      const data = await response.json()
      return data.response
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }
})
