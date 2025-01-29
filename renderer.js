let selectedFiles = [];

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('pdf-file');
    const selectedFilesDiv = document.getElementById('selected-files');
    const queryText = document.getElementById('query-text');
    const submitButton = document.getElementById('submit-query');
    const responseText = document.getElementById('response-text');
    const loadingIndicator = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const apiKeyStatus = document.getElementById('api-key-status');

    // Check for existing API key
    try {
        const existingKey = await window.api.getApiKey();
        if (existingKey) {
            apiKeyInput.value = '********'; // Mask the actual key
            apiKeyStatus.textContent = 'API key is saved';
            apiKeyStatus.className = 'status-message success';
            apiKeyStatus.style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
    }

    // Handle API key saving
    saveApiKeyButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            apiKeyStatus.textContent = 'Please enter an API key';
            apiKeyStatus.className = 'status-message error';
            apiKeyStatus.style.display = 'block';
            return;
        }

        try {
            await window.api.saveApiKey(apiKey);
            apiKeyInput.value = '********'; // Mask the key after saving
            apiKeyStatus.textContent = 'API key saved successfully';
            apiKeyStatus.className = 'status-message success';
            apiKeyStatus.style.display = 'block';
        } catch (error) {
            apiKeyStatus.textContent = `Error saving API key: ${error.message}`;
            apiKeyStatus.className = 'status-message error';
            apiKeyStatus.style.display = 'block';
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        selectedFiles = [];
        selectedFilesDiv.innerHTML = '';
        
        files.forEach(file => {
            if (!file.type.includes('pdf')) {
                errorMessage.textContent = `File ${file.name} is not a PDF`;
                errorMessage.style.display = 'block';
                return;
            }
            selectedFiles.push(file);
            const fileDiv = document.createElement('div');
            fileDiv.textContent = file.name;
            selectedFilesDiv.appendChild(fileDiv);
        });

        if (selectedFiles.length > 0) {
            errorMessage.style.display = 'none';
        } else {
            selectedFilesDiv.innerHTML = '';
        }
    });

    // Handle form submission
    submitButton.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            errorMessage.textContent = 'Please select at least one PDF file';
            errorMessage.style.display = 'block';
            return;
        }

        if (!queryText.value.trim()) {
            errorMessage.textContent = 'Please enter a question';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            errorMessage.style.display = 'none';
            loadingIndicator.style.display = 'block';
            submitButton.disabled = true;
            
            // Clear previous results
            const responseTable = document.getElementById('response-table');
            const tbody = responseTable.querySelector('tbody');
            tbody.innerHTML = '';
            responseTable.style.display = 'table';
            responseText.style.display = 'none';

            // Process each file
            for (const file of selectedFiles) {
                try {
                    // Read file as ArrayBuffer
                    const fileBuffer = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsArrayBuffer(file);
                    });

                    const response = await window.api.queryPDF(fileBuffer, queryText.value.trim());
                    
                    // Parse XML response
                    const parser = new DOMParser();
                    
                    // Extract and parse thinking process
                    const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
                    const resultsMatch = response.match(/<results>([\s\S]*?)<\/results>/);
                    
                    if (!thinkingMatch || !resultsMatch) {
                        // Handle old format or missing tags
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${file.name}</td>
                            <td>${queryText.value.trim()}</td>
                            <td>No structured data found</td>
                            <td>No structured data found</td>
                        `;
                        tbody.appendChild(row);
                        continue;
                    }
                    
                    // Parse thinking XML
                    const thinkingXml = parser.parseFromString(
                        `<root>${thinkingMatch[1]}</root>`, 
                        'text/xml'
                    );
                    
                    // Parse results XML
                    const resultsXml = parser.parseFromString(
                        `<root>${resultsMatch[1]}</root>`, 
                        'text/xml'
                    );
                    
                    // Get all data entries
                    const thinkingData = Array.from(thinkingXml.querySelectorAll('data'));
                    const resultsData = Array.from(resultsXml.querySelectorAll('data'));
                    
                    // Create a row for each data entry
                    const maxEntries = Math.max(thinkingData.length, resultsData.length);
                    
                    // Map thinking data to results data by name
                    for (let i = 0; i < maxEntries; i++) {
                        const thinkingEntry = thinkingData[i];
                        const thinkingName = thinkingEntry?.querySelector('name')?.textContent.trim();
                        
                        // Find matching result entry
                        const resultEntry = resultsData.find(entry => 
                            entry.querySelector('name')?.textContent.trim() === thinkingName
                        );
                        const row = document.createElement('tr');
                        
                        // Add file name
                        row.innerHTML = `<td>${file.name}</td>`;
                        
                        // Add query from name tag
                        if (thinkingName) {
                            row.innerHTML += `<td>${thinkingName}</td>`;
                        } else {
                            row.innerHTML += '<td></td>';
                        }
                        
                        // Add thinking process
                        if (thinkingEntry) {
                            const process = thinkingEntry.querySelector('process')?.textContent.trim() || '';
                            row.innerHTML += `<td>${process}</td>`;
                        } else {
                            row.innerHTML += '<td></td>';
                        }
                        
                        // Add results
                        if (resultEntry) {
                            const value = resultEntry.querySelector('value')?.textContent.trim() || '';
                            row.innerHTML += `<td>${value}</td>`;
                        } else {
                            row.innerHTML += '<td></td>';
                        }
                        
                        tbody.appendChild(row);
                    }
                } catch (error) {
                    // Add error result to table
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${file.name}</td>
                        <td>${queryText.value.trim()}</td>
                        <td class="error" colspan="2">Error: ${error.message}</td>
                    `;
                    tbody.appendChild(row);
                }
            }
        } catch (error) {
            errorMessage.textContent = `Error: ${error.message}`;
            errorMessage.style.display = 'block';
        } finally {
            loadingIndicator.style.display = 'none';
            submitButton.disabled = false;
        }
    });
});
