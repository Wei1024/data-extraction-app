const { app, BrowserWindow, session, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { Anthropic } = require('@anthropic-ai/sdk')
const keytar = require('keytar')
const { MODEL_CONFIG, API_ENDPOINTS } = require('./config/anthropic')

// Service name for keytar (must match preload.js)
const SERVICE_NAME = 'pdf-query-app'
const ACCOUNT_NAME = 'anthropic-api-key'

// Create projects directory in user data path
const projectsPath = path.join(app.getPath('userData'), 'projects')
if (!fs.existsSync(projectsPath)) {
    fs.mkdirSync(projectsPath)
}

// Get all projects
ipcMain.handle('get-projects', async () => {
    try {
        const projectDirs = await fs.promises.readdir(projectsPath)
        const projects = []

        for (const projectDir of projectDirs) {
            const projectPath = path.join(projectsPath, projectDir)
            const stats = await fs.promises.stat(projectPath)

            if (stats.isDirectory()) {
                const files = await fs.promises.readdir(projectPath)
                const pdfs = []

                for (const file of files) {
                    if (file.toLowerCase().endsWith('.pdf')) {
                        const filePath = path.join(projectPath, file)
                        const fileStats = await fs.promises.stat(filePath)
                        
                        // Get extraction results if they exist
                        const resultsPath = filePath + '.results.json'
                        let extractionResults = null
                        try {
                            if (fs.existsSync(resultsPath)) {
                                const resultsData = await fs.promises.readFile(resultsPath, 'utf8')
                                extractionResults = JSON.parse(resultsData)
                            }
                        } catch (error) {
                            console.error(`Error reading results for ${file}:`, error)
                        }

                        pdfs.push({
                            name: file,
                            path: filePath,
                            size: fileStats.size,
                            created: fileStats.birthtime,
                            modified: fileStats.mtime,
                            extractionResults
                        })
                    }
                }

                projects.push({
                    id: projectDir,
                    name: projectDir,
                    path: projectPath,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    pdfs
                })
            }
        }

        // Sort projects by modified date, newest first
        projects.sort((a, b) => b.modified - a.modified)
        return projects
    } catch (error) {
        console.error('Error getting projects:', error)
        throw error
    }
})

// Handle PDF file storage
ipcMain.handle('store-pdf', async (event, { projectName, fileBuffer, fileName }) => {
    try {
        // Create project directory if it doesn't exist
        const projectDir = path.join(projectsPath, sanitizeProjectName(projectName))
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir)
        }

        const originalFilePath = path.join(projectDir, sanitizeFileName(fileName))
        let filePath = originalFilePath
        
        // Check if file already exists
        if (fs.existsSync(originalFilePath)) {
            // Ask user what to do via dialog
            const { response } = await event.sender.invoke('show-duplicate-dialog', fileName)
            
            if (response === 'replace') {
                // Use the original path (will overwrite)
                filePath = originalFilePath
            } else if (response === 'keep-both') {
                // Find next available number
                let counter = 1
                const ext = path.extname(fileName)
                const nameWithoutExt = path.basename(fileName, ext)
                
                while (fs.existsSync(filePath)) {
                    filePath = path.join(projectDir, sanitizeFileName(`${nameWithoutExt}(${counter})${ext}`))
                    counter++
                }
            } else {
                // User cancelled
                return { success: false, reason: 'cancelled' }
            }
        }

        // Write file to disk
        await fs.promises.writeFile(filePath, Buffer.from(fileBuffer))

        return {
            success: true,
            filePath: filePath,
            fileName: path.basename(filePath)
        }
    } catch (error) {
        console.error('Error storing PDF:', error)
        throw error
    }
})

// Handle saving extraction results
ipcMain.handle('save-extraction-results', async (event, { projectName, fileName, results }) => {
    try {
        const projectDir = path.join(projectsPath, sanitizeProjectName(projectName))
        const pdfPath = path.join(projectDir, sanitizeFileName(fileName))
        const resultsPath = pdfPath + '.results.json'
        
        // Load existing results if any
        let existingResults = {}
        try {
            if (fs.existsSync(resultsPath)) {
                const resultsData = await fs.promises.readFile(resultsPath, 'utf8')
                existingResults = JSON.parse(resultsData)
            }
        } catch (error) {
            console.error(`Error reading existing results for ${fileName}:`, error)
        }
        
        // If this topic doesn't exist yet, create an array for it
        if (!existingResults[results.topic]) {
            existingResults[results.topic] = []
        }
        
        // Add the new result to the array for this topic
        existingResults[results.topic].push({
            query: results.query,
            thinking: results.thinking,
            result: results.result,
            citations: results.citations,
            timestamp: results.timestamp || new Date().toISOString()
        })
        
        // Write updated results
        await fs.promises.writeFile(
            resultsPath,
            JSON.stringify(existingResults, null, 2),
            'utf8'
        )
        
        return { success: true }
    } catch (error) {
        console.error('Error saving extraction results:', error)
        throw error
    }
})

// Helper function to sanitize project names
function sanitizeProjectName(name) {
    return name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase()
}

// Helper function to sanitize file names
function sanitizeFileName(name) {
    return name.replace(/[^a-z0-9.-]/gi, '_').toLowerCase()
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    icon: path.join(__dirname, 'assets', 'images', 'WeiToGo-logo-v2.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  })

  // Configure CSP to allow Anthropic API requests
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; connect-src 'self' https://api.anthropic.com; script-src 'self'; style-src 'self' 'unsafe-inline'"
        ]
      }
    })
  })

  win.loadFile('index.html')

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }

  // Clear batch jobs before window closes
  win.on('close', () => {
    win.webContents.send('clear-batch-jobs')
  })

  // Handle batch results streaming
  ipcMain.handle('stream-batch-results', async (event, batchId) => {
    try {
      const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
      if (!apiKey) {
        throw new Error('API key not found')
      }

      const anthropic = new Anthropic({ 
        apiKey,
        apiVersion: MODEL_CONFIG.api_version
      })
      const results = []

      // Stream results using the SDK
      for await (const result of await anthropic.messages.batches.results(batchId)) {
        results.push(result)
      }

      return results
    } catch (error) {
      console.error('Error streaming batch results:', error)
      throw error
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
