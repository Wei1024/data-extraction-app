let selectedFiles = [];

// Helper function to create a new data field row
const createDataFieldRow = () => {
    const row = document.createElement('div');
    row.className = 'data-field-row';
    row.innerHTML = `
        <input type="text" class="field-name" placeholder="Data field name (required)" required>
        <input type="text" class="field-unit" placeholder="Unit (optional)">
        <input type="text" class="field-description" placeholder="Description (optional but recommended)">
        <button type="button" class="remove-field">-</button>
    `;
    return row;
};

// Helper function to create a new topic section
const createTopicSection = () => {
    const section = document.createElement('div');
    section.className = 'topic-section';
    section.innerHTML = `
        <div class="topic-header">
            <input type="text" class="topic-name" placeholder="Topic name (required)" required>
            <button type="button" class="remove-topic">Remove Topic</button>
        </div>
        <div class="data-fields-container">
            <div class="data-field-row">
                <input type="text" class="field-name" placeholder="Data field name (required)" required>
                <input type="text" class="field-unit" placeholder="Unit (optional)">
                <input type="text" class="field-description" placeholder="Description (optional but recommended)">
                <button type="button" class="remove-field" style="display: none;">-</button>
            </div>
        </div>
        <button type="button" class="add-field-btn">+</button>
    `;
    return section;
};

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('pdf-file');
    const selectedFilesDiv = document.getElementById('selected-files');
    const topicsContainer = document.getElementById('topics-container');
    const addTopicButton = document.getElementById('add-topic');
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

    // Handle adding new topics
    addTopicButton.addEventListener('click', () => {
        const topicSection = createTopicSection();
        topicsContainer.appendChild(topicSection);
        
        // Show all remove topic buttons when there's more than one topic
        const removeTopicButtons = topicsContainer.getElementsByClassName('remove-topic');
        Array.from(removeTopicButtons).forEach(button => button.style.display = 'block');
    });

    // Handle removing topics
    topicsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-topic')) {
            const currentTopics = topicsContainer.getElementsByClassName('topic-section').length;
            if (currentTopics > 1) {
                event.target.closest('.topic-section').remove();
                
                // Hide remove button on the last remaining topic
                if (currentTopics - 1 === 1) {
                    const lastRemoveButton = topicsContainer.querySelector('.remove-topic');
                    if (lastRemoveButton) {
                        lastRemoveButton.style.display = 'none';
                    }
                }
            }
        }
    });

    // Handle adding new data field rows within topics
    topicsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-field-btn')) {
            const dataFieldsContainer = event.target.previousElementSibling;
            const currentRows = dataFieldsContainer.getElementsByClassName('data-field-row').length;
            
            if (currentRows >= 5) {
                event.target.disabled = true;
                return;
            }

            const newRow = createDataFieldRow();
            dataFieldsContainer.appendChild(newRow);

            if (currentRows + 1 >= 5) {
                event.target.disabled = true;
            }

            // Show remove buttons when there's more than one row
            const removeButtons = dataFieldsContainer.getElementsByClassName('remove-field');
            Array.from(removeButtons).forEach(button => button.style.display = 'block');
        }
    });

    // Handle removing data field rows within topics
    topicsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-field')) {
            const dataFieldsContainer = event.target.closest('.data-fields-container');
            const addFieldButton = dataFieldsContainer.nextElementSibling;
            const currentRows = dataFieldsContainer.getElementsByClassName('data-field-row').length;
            
            if (currentRows > 1) {
                event.target.closest('.data-field-row').remove();
                addFieldButton.disabled = false;

                // Hide remove button on the last remaining row
                if (currentRows - 1 === 1) {
                    const lastRemoveButton = dataFieldsContainer.querySelector('.remove-field');
                    if (lastRemoveButton) {
                        lastRemoveButton.style.display = 'none';
                    }
                }
            }
        }
    });

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

        // Validate and collect data from all topics
        const topics = Array.from(topicsContainer.getElementsByClassName('topic-section'));
        const formattedTopics = [];
        let hasEmptyRequired = false;

        topics.forEach((topic) => {
            const topicNameInput = topic.querySelector('.topic-name');
            const topicName = topicNameInput.value.trim();

            if (!topicName) {
                hasEmptyRequired = true;
                topicNameInput.style.borderColor = '#dc3545';
                return;
            }
            topicNameInput.style.borderColor = '#ddd';

            const dataFields = Array.from(topic.getElementsByClassName('data-field-row'));
            const formattedQuery = [];

            dataFields.forEach((row, index) => {
                const nameInput = row.querySelector('.field-name');
                const unitInput = row.querySelector('.field-unit');
                const descInput = row.querySelector('.field-description');

                if (!nameInput.value.trim()) {
                    hasEmptyRequired = true;
                    nameInput.style.borderColor = '#dc3545';
                } else {
                    nameInput.style.borderColor = '#ddd';
                    let queryLine = `${index + 1}. ${nameInput.value.trim()}`;
                    
                    if (unitInput.value.trim()) {
                        queryLine += ` (${unitInput.value.trim()})`;
                    }
                    
                    if (descInput.value.trim()) {
                        queryLine += `: ${descInput.value.trim()}`;
                    }
                    
                    formattedQuery.push(queryLine);
                }
            });

            if (!hasEmptyRequired) {
                formattedTopics.push({
                    name: topicName,
                    query: formattedQuery.join('\n')
                });
            }
        });

        if (hasEmptyRequired) {
            errorMessage.textContent = 'Please fill in all required topic names and data field names';
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

            // Process files sequentially
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                
                // Process each topic for the current file
                for (let j = 0; j < formattedTopics.length; j++) {
                    const topic = formattedTopics[j];
                    try {
                        // Show processing status
                        loadingIndicator.textContent = `Processing ${i + 1}/${selectedFiles.length}: ${file.name}\nTopic ${j + 1}/${formattedTopics.length}: ${topic.name}`;

                        // Read file as ArrayBuffer
                        const fileBuffer = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = () => reject(reader.error);
                            reader.readAsArrayBuffer(file);
                        });

                        // Add delay between API calls to prevent rate limiting
                        if (i > 0 || j > 0) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }

                        const response = await window.api.queryPDF(fileBuffer, topic.query, (retryInfo) => {
                            const { attempt, maxRetries, delay, error } = retryInfo;
                            const waitSeconds = Math.ceil(delay / 1000);
                            loadingIndicator.textContent = `Processing ${i + 1}/${selectedFiles.length}: ${file.name}\nTopic ${j + 1}/${formattedTopics.length}: ${topic.name}\nRetry ${attempt}/${maxRetries}: Waiting ${waitSeconds}s before retry...\nReason: ${error.message}`;
                        });
                    
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
                                <td>${topic.name}</td>
                                <td>${topic.query}</td>
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
                        for (let k = 0; k < maxEntries; k++) {
                            const thinkingEntry = thinkingData[k];
                            const thinkingName = thinkingEntry?.querySelector('name')?.textContent.trim();
                            
                            // Find matching result entry
                            const resultEntry = resultsData.find(entry => 
                                entry.querySelector('name')?.textContent.trim() === thinkingName
                            );
                            const row = document.createElement('tr');
                            
                            // Add file name and topic
                            row.innerHTML = `
                                <td>${file.name}</td>
                                <td>${topic.name}</td>
                            `;
                            
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
                            <td>${topic.name}</td>
                            <td>${topic.query}</td>
                            <td class="error" colspan="2">Error: ${error.message}</td>
                        `;
                        tbody.appendChild(row);
                    }
                }
            }
        } catch (error) {
            errorMessage.textContent = `Error: ${error.message}`;
            errorMessage.style.display = 'block';
        } finally {
            loadingIndicator.textContent = 'Processing...';
            loadingIndicator.style.display = 'none';
            submitButton.disabled = false;
        }
    });
});
