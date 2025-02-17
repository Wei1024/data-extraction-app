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

// Handle PDF file storage
ipcMain.handle('store-pdf', async (event, { projectName, fileBuffer, fileName }) => {
    try {
        // Create project directory if it doesn't exist
        const projectDir = path.join(projectsPath, sanitizeProjectName(projectName))
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir)
        }

        // Generate unique filename
        const timestamp = Date.now()
        const uniqueFileName = `${timestamp}-${sanitizeFileName(fileName)}`
        const filePath = path.join(projectDir, uniqueFileName)

        // Write file to disk
        await fs.promises.writeFile(filePath, Buffer.from(fileBuffer))

        return {
            success: true,
            filePath: filePath,
            fileName: uniqueFileName
        }
    } catch (error) {
        console.error('Error storing PDF:', error)
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
