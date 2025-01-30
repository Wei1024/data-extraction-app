# PDF Data Extraction App

A desktop application built with Electron that enables automated data extraction from PDF documents using the Anthropic API. The app provides an intuitive interface for uploading PDFs and specifying the data fields you want to extract, making it easy to process multiple documents efficiently.

## Features

- 🔐 Secure API key management
- 📄 Support for multiple PDF file uploads
- 🎯 Custom data field specification with optional units and descriptions
- 📊 Structured results display in tabular format
- 💭 Transparent extraction process with visible thinking steps
- 🔒 Built-in security with Content Security Policy (CSP)
- 💻 Cross-platform support (Windows, macOS, Linux)

## Installation

1. Download the latest release for your operating system from the releases page
2. Install the application:
   - Windows: Run the installer (.exe)
   - macOS: Mount the .dmg file and drag the app to Applications
   - Linux: Run the AppImage file

## Usage

1. Launch the application
2. Enter your Anthropic API key (required for data extraction)
3. Click "Choose PDF File(s)" to select one or more PDF documents
4. Define the data fields you want to extract:
   - Field Name (required)
   - Unit (optional)
   - Description (optional, but recommended for better extraction accuracy)
5. Click "Submit Query" to start the extraction process
6. View results in the table, including:
   - PDF file name
   - Original query
   - AI thinking process
   - Extracted data

## Development Setup

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm (Comes with Node.js)

### Installation Steps

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd data-extraction-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

### Building from Source

To create distributable packages for different platforms:

```bash
npm run build
```

This will create platform-specific packages in the `dist` directory.

## Dependencies

- Electron: Desktop application framework
- form-data: Handling form data
- keytar: Secure credential storage
- node-fetch: Making HTTP requests

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
