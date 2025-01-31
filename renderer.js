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

// Helper function to convert table data to CSV
const tableToCSV = (table) => {
    const rows = table.querySelectorAll('tr');
    const csvRows = [];
    
    for (const row of rows) {
        const cells = row.querySelectorAll('th, td');
        const csvRow = Array.from(cells)
            .map(cell => {
                // Escape quotes and wrap content in quotes to handle commas and newlines
                const content = cell.textContent.replace(/"/g, '""');
                return `"${content}"`;
            })
            .join(',');
        csvRows.push(csvRow);
    }
    
    return csvRows.join('\n');
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
    const downloadButton = document.getElementById('download-csv');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const apiKeyStatus = document.getElementById('api-key-status');
    const batchModeToggle = document.getElementById('batch-mode-toggle');
    const batchJobsContainer = document.getElementById('batch-jobs-container');
    const refreshBatchStatusButton = document.getElementById('refresh-batch-status');

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

    // Enhanced batch jobs view
    const updateBatchJobsView = () => {
        const jobs = window.api.listBatchJobs({ includeExpired: false });
        const batchJobsList = document.getElementById('batch-jobs-list');
        batchJobsList.innerHTML = '';

        jobs.forEach(job => {
            const jobElement = document.createElement('div');
            jobElement.className = 'batch-job';
            
            const statusClass = job.processing_status === 'ended' ? 'success' : 
                              job.error ? 'error' : 'processing';
            
            // Calculate time remaining or expiration
            const now = new Date();
            const expirationDate = new Date(job.created_at);
            expirationDate.setDate(expirationDate.getDate() + 29);
            const timeRemaining = expirationDate - now;
            const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

            jobElement.innerHTML = `
                <div class="job-header">
                    <span class="job-id">Job ID: ${job.id}</span>
                    <div class="job-status-container">
                        <span class="job-status ${statusClass}">${job.processing_status}</span>
                        ${job.processing_status !== 'ended' && !job.cancel_initiated_at ? 
                            `<button class="cancel-job" data-job-id="${job.id}">Cancel</button>` : ''}
                    </div>
                </div>
                <div class="job-details">
                    <div class="job-timing">
                        <div>Submitted: ${new Date(job.created_at).toLocaleString()}</div>
                        <div>Expires in: ${daysRemaining} days</div>
                        ${job.ended_at ? `<div>Completed: ${new Date(job.ended_at).toLocaleString()}</div>` : ''}
                    </div>
                    <div class="job-content">
                        <div>Files: ${job.files.join(', ')}</div>
                        <div>Topics: ${job.topics.join(', ')}</div>
                    </div>
                    <div class="job-progress">
                        <div>Status: ${job.request_counts ? `
                            Processing: ${job.request_counts.processing},
                            Succeeded: ${job.request_counts.succeeded},
                            Errored: ${job.request_counts.errored},
                            Canceled: ${job.request_counts.canceled},
                            Expired: ${job.request_counts.expired}
                        ` : 'Initializing...'}</div>
                    </div>
                    ${job.cache_stats ? `
                    <div class="cache-stats">
                            <div>Results Summary:</div>
                            <div>Succeeded: ${job.cache_stats.succeeded}</div>
                            <div>Errored: ${job.cache_stats.errored}</div>
                            <div>Canceled: ${job.cache_stats.canceled}</div>
                            <div>Expired: ${job.cache_stats.expired}</div>
                            <div>Total: ${job.cache_stats.total}</div>
                            <div class="cache-performance">
                                <div>Cache Performance:</div>
                                <div>Hits: ${job.cache_stats.hits}</div>
                                <div>Misses: ${job.cache_stats.misses}</div>
                                <div>Hit Rate: ${job.cache_stats.hit_rate.toFixed(1)}%</div>
                            </div>
                        </div>
                    ` : ''}
                    ${job.costs ? `
                        <div class="job-costs">
                            <div class="cost-section">
                                <h4>Regular Costs:</h4>
                                <div>Input: $${job.costs.regular.input.toFixed(4)}</div>
                                <div>Output: $${job.costs.regular.output.toFixed(4)}</div>
                                <div>Total: $${job.costs.regular.total.toFixed(4)}</div>
                            </div>
                            <div class="cost-section">
                                <h4>Cached Costs:</h4>
                                <div>Input: $${job.costs.cached.input.toFixed(4)}</div>
                                <div>Output: $${job.costs.cached.output.toFixed(4)}</div>
                                <div>Total: $${job.costs.cached.total.toFixed(4)}</div>
                            </div>
                            <div class="cost-savings">
                                <div>Total Cost: $${job.costs.total.toFixed(4)}</div>
                                <div>Savings: $${job.costs.savings.toFixed(4)}</div>
                            </div>
                        </div>
                    ` : ''}
                    ${job.error ? `<div class="job-error">Error: ${job.error}</div>` : ''}
                </div>
                ${job.processing_status === 'ended' ? `
                    <button class="download-results" data-job-id="${job.id}">Download Results</button>
                ` : ''}
            `;
            
            batchJobsList.appendChild(jobElement);
        });
    };

    // Enhanced batch mode toggle
    if (batchModeToggle) {
        const batchModeOptions = document.createElement('div');
        batchModeOptions.className = 'batch-mode-options';
        batchModeOptions.innerHTML = `
            <div class="option">
                <label>
                    <input type="checkbox" id="enable-caching" checked>
                    Enable Caching (recommended for similar content)
                </label>
                <div class="option-description">
                    Caching can reduce costs by up to 90% for similar content within 5 minutes
                </div>
            </div>
            <div class="batch-size-warning" style="display: none;">
                Warning: Current batch size approaching 256MB limit
            </div>
        `;
        batchModeToggle.parentNode.appendChild(batchModeOptions);

        batchModeToggle.addEventListener('change', () => {
            const isBatchMode = batchModeToggle.checked;
            document.body.classList.toggle('batch-mode', isBatchMode);
            batchJobsContainer.style.display = isBatchMode ? 'block' : 'none';
            submitButton.textContent = isBatchMode ? 'Submit Batch Job' : 'Submit Query';
            batchModeOptions.style.display = isBatchMode ? 'block' : 'none';
        });
    }

    // Enhanced refresh batch status with auto-refresh
    if (refreshBatchStatusButton) {
        let autoRefreshInterval = null;

        const refreshStatus = async () => {
            const jobs = window.api.listBatchJobs();
            let hasProcessingJobs = false;

            for (const job of jobs) {
                if (job.processing_status === 'in_progress') {
                    hasProcessingJobs = true;
                    try {
                        await window.api.getBatchJobStatus(job.id);
                    } catch (error) {
                        console.error(`Failed to update status for job ${job.id}:`, error);
                    }
                }
            }

            updateBatchJobsView();

            // Stop auto-refresh if no jobs are processing
            if (!hasProcessingJobs && autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                refreshBatchStatusButton.textContent = 'Refresh Status';
            }
        };

        refreshBatchStatusButton.addEventListener('click', async () => {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                refreshBatchStatusButton.textContent = 'Refresh Status';
            } else {
                refreshBatchStatusButton.textContent = 'Auto-Refreshing...';
                autoRefreshInterval = setInterval(refreshStatus, 30000); // Refresh every 30 seconds
            }
            await refreshStatus();
        });
    }

    // Handle batch job cancellation
    batchJobsContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('cancel-job')) {
            const jobId = event.target.dataset.jobId;
            try {
                await window.api.cancelBatchJob(jobId);
                updateBatchJobsView();
            } catch (error) {
                console.error(`Failed to cancel job ${jobId}:`, error);
            }
        }
    });

    // Handle batch job results download
    batchJobsContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('download-results')) {
            const button = event.target;
            const originalText = button.textContent;
            const jobId = button.dataset.jobId;
            const job = window.api.listBatchJobs().find(j => j.id === jobId);
            
            if (job && job.processing_status === 'ended') {
                try {
                    // Show loading state
                    button.disabled = true;
                    button.textContent = 'Downloading...';
                    button.classList.add('downloading');
                    
                    // Get results through main process
                    const results = await window.api.getBatchJobStatus(jobId);
                    
                    if (results.results && results.results.length > 0) {
                        // Extract topic and query from custom_id
                        const csv = results.results.map(result => {
                            if (result.result?.message?.content?.[0]?.text) {
                                const content = result.result.message.content[0].text;
                                
                                // Extract PDF name from custom_id by removing the -test suffix
                                const pdfName = result.custom_id.replace('_pdf-test', '');
                                
                                // Get topic from job data
                                const [pdfTopic] = job.topics.filter(t => 
                                    result.custom_id.includes(t.toLowerCase().replace(/\s+/g, '_'))
                                ) || [''];

                                let query = '';
                                let thinkingProcess = '';
                                let finalResults = '';

                                // Extract thinking process
                                const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
                                if (thinkingMatch) {
                                    // Extract process from thinking content
                                    const thinkingProcessMatch = thinkingMatch[1].match(/<process>(.*?)<\/process>/);
                                    if (thinkingProcessMatch) {
                                        thinkingProcess = thinkingProcessMatch[1].trim();
                                    }

                                    // Extract query from name tag
                                    const nameMatch = thinkingMatch[1].match(/<name>(.*?)<\/name>/);
                                    if (nameMatch) {
                                        query = nameMatch[1].trim();
                                    }
                                }

                                // Extract final results
                                const resultsMatch = content.match(/<results>([\s\S]*?)<\/results>/);
                                if (resultsMatch) {
                                    // Extract value from results content
                                    const resultsValueMatch = resultsMatch[1].match(/<value>(.*?)<\/value>/);
                                    if (resultsValueMatch) {
                                        finalResults = resultsValueMatch[1].trim();
                                    }
                                }

                                // Escape quotes and wrap fields in quotes
                                const escapeField = (field) => {
                                    return `"${field.toString().replace(/"/g, '""')}"`;
                                };

                                return [
                                    escapeField(pdfName),
                                    escapeField(pdfTopic),
                                    escapeField(query),
                                    escapeField(thinkingProcess),
                                    escapeField(finalResults)
                                ].join(',');
                            }
                            return `"${result.custom_id}","","","Error: No content","Error: No content"`;
                        }).join('\n');
                        
                        const header = 'PDF Name,Topic,Query,Thinking Process,Final Results\n';
                        const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        link.href = URL.createObjectURL(blob);
                        link.download = `batch-results-${jobId}-${timestamp}.csv`;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Show success state briefly
                        button.textContent = 'Downloaded!';
                        button.classList.remove('downloading');
                        button.classList.add('success');
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.classList.remove('success');
                            button.disabled = false;
                        }, 2000);
                    } else {
                        console.error('No results found in job:', results);
                        button.textContent = 'No results found';
                        button.classList.remove('downloading');
                        button.classList.add('error');
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.classList.remove('error');
                            button.disabled = false;
                        }, 3000);
                    }
                } catch (error) {
                    console.error('Error downloading results:', error);
                    button.textContent = 'Download failed';
                    button.classList.remove('downloading');
                    button.classList.add('error');
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.classList.remove('error');
                        button.disabled = false;
                    }, 3000);
                }
            }
        }
    });

    // Handle form submission
    submitButton.addEventListener('click', async () => {
        const isBatchMode = batchModeToggle?.checked;
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

            if (isBatchMode) {
                // Calculate total batch size
                const totalSize = new Blob([JSON.stringify(formattedTopics)]).size * selectedFiles.length;
                const batchSizeWarning = document.querySelector('.batch-size-warning');
                if (totalSize > window.api.constants.MAX_BATCH_SIZE * 0.8) { // Show warning at 80% of limit
                    batchSizeWarning.style.display = 'block';
                    batchSizeWarning.textContent = `Warning: Batch size at ${Math.round(totalSize / window.api.constants.MAX_BATCH_SIZE * 100)}% of limit`;
                }

                // Submit batch job with options
                const options = {
                    enableCaching: document.getElementById('enable-caching').checked
                };
                const batchJob = await window.api.submitBatchQuery(selectedFiles, formattedTopics, options);
                updateBatchJobsView();
                loadingIndicator.textContent = `Batch job ${batchJob.id} submitted successfully. Results will be available within 24 hours.`;
                
                // Start auto-refresh
                refreshBatchStatusButton.click();
                return;
            }
            
            // Clear previous results
            const responseTable = document.getElementById('response-table');
            const tbody = responseTable.querySelector('tbody');
            tbody.innerHTML = '';
            responseTable.style.display = 'table';
            responseText.style.display = 'none';
            downloadButton.style.display = 'block';

            // Reset cost summary
            const costSummary = document.querySelector('.cost-summary');
            costSummary.style.display = 'block';
            let totalUsage = {
                input_tokens: 0,
                output_tokens: 0,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0
            };
            let totalCosts = {
                input: 0,
                output: 0,
                cache_read: 0,
                cache_creation: 0
            };

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

                        const result = await window.api.queryPDF(fileBuffer, topic.query, (retryInfo) => {
                            const { attempt, maxRetries, delay, error } = retryInfo;
                            const waitSeconds = Math.ceil(delay / 1000);
                            loadingIndicator.textContent = `Processing ${i + 1}/${selectedFiles.length}: ${file.name}\nTopic ${j + 1}/${formattedTopics.length}: ${topic.name}\nRetry ${attempt}/${maxRetries}: Waiting ${waitSeconds}s before retry...\nReason: ${error.message}`;
                        });
                    
                        // Update usage totals
                        if (result.usage) {
                            totalUsage.input_tokens += result.usage.input_tokens || 0;
                            totalUsage.output_tokens += result.usage.output_tokens || 0;
                            totalUsage.cache_read_input_tokens += result.usage.cache_read_input_tokens || 0;
                            totalUsage.cache_creation_input_tokens += result.usage.cache_creation_input_tokens || 0;
                        }

                        // Update cost totals
                        if (result.costs) {
                            totalCosts.input += result.costs.input || 0;
                            totalCosts.output += result.costs.output || 0;
                            totalCosts.cache_read += result.costs.cache_read || 0;
                            totalCosts.cache_creation += result.costs.cache_creation || 0;
                        }

                        // Update cost summary display
                        document.getElementById('input-tokens').textContent = totalUsage.input_tokens.toLocaleString();
                        document.getElementById('output-tokens').textContent = totalUsage.output_tokens.toLocaleString();
                        document.getElementById('cache-read-tokens').textContent = totalUsage.cache_read_input_tokens.toLocaleString();
                        document.getElementById('cache-creation-tokens').textContent = totalUsage.cache_creation_input_tokens.toLocaleString();

                        document.getElementById('input-cost').textContent = totalCosts.input.toFixed(4);
                        document.getElementById('output-cost').textContent = totalCosts.output.toFixed(4);
                        document.getElementById('cache-read-cost').textContent = totalCosts.cache_read.toFixed(4);
                        document.getElementById('cache-creation-cost').textContent = totalCosts.cache_creation.toFixed(4);
                        document.getElementById('total-cost').textContent = (
                            totalCosts.input + 
                            totalCosts.output + 
                            totalCosts.cache_read + 
                            totalCosts.cache_creation
                        ).toFixed(4);

                        // Parse XML response
                        const parser = new DOMParser();
                        
                        // Extract and parse thinking process
                        const thinkingMatch = result.content[0].text.match(/<thinking>([\s\S]*?)<\/thinking>/);
                        const resultsMatch = result.content[0].text.match(/<results>([\s\S]*?)<\/results>/);
                        
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

    // Handle CSV download
    downloadButton.addEventListener('click', () => {
        const table = document.getElementById('response-table');
        const csv = tableToCSV(table);
        
        // Create a Blob containing the CSV data
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        
        // Create a download link and trigger it
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = URL.createObjectURL(blob);
        link.download = `extraction-results-${timestamp}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
