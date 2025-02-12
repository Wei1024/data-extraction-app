let selectedFiles = [];

// Helper function to create a new data field row
const createDataFieldRow = () => {
    const row = document.createElement('div');
    row.className = 'data-field-row';
    row.innerHTML = `
        <input type="text" class="field-name" placeholder="Data field name (required)" required>
        <input type="text" class="field-unit" placeholder="Result format" title="Expected result format (e.g., number list, bullet points)">
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
                <input type="text" class="field-unit" placeholder="Result format" title="Expected result format (e.g., number list, bullet points)">
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
    const csvImportInput = document.getElementById('csv-import');
    const downloadTemplateButton = document.getElementById('download-template');

    // Handle template download
    downloadTemplateButton.addEventListener('click', () => {
        const templateContent = `topic_name,field_name,result_format,description
Study Characteristics,Study Design,text,Type of study (e.g. RCT)
Study Characteristics,Sample Size,number,Total number of participants in the study
Study Characteristics,Population,text,Description of study population and inclusion criteria
Study Characteristics,Follow-up Duration,text,Length of study follow-up period
Clinical Outcomes,Primary Endpoint,text,Primary outcome measure of the study
Clinical Outcomes,Effect Size,number with CI,Treatment effect with confidence interval
Clinical Outcomes,P-value,number,Statistical significance of primary outcome
Clinical Outcomes,Adverse Events,bullet points,List of reported adverse events
Economic Analysis,Cost Measure,currency,Type and amount of costs analyzed
Economic Analysis,ICER,currency/QALY,Incremental cost-effectiveness ratio
Economic Analysis,Utility Values,number,Health state utility values used
Economic Analysis,Time Horizon,text,Time horizon of economic analysis
Quality Assessment,Risk of Bias,text,Assessment of study bias and limitations
Quality Assessment,GRADE Score,text,Quality of evidence assessment
Quality Assessment,Funding Source,text,Study sponsor and funding details`;

        const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'topic-template.csv';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

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

    // Helper function to parse CSV content
    const parseCSV = (content) => {
        const rows = content.split(/\r?\n/).filter(row => row.trim());
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        // Validate required columns
        const requiredColumns = ['topic_name', 'field_name'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }

    // Parse data rows
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        // Initialize variables for parsing
        const values = [];
        let currentValue = '';
        let insideQuotes = false;
        const row = rows[i];

        // Parse each character
        for (let j = 0; j < row.length; j++) {
            const char = row[j];
            
            if (char === '"') {
                if (insideQuotes && row[j + 1] === '"') {
                    // Handle escaped quotes
                    currentValue += '"';
                    j++;
                } else {
                    // Toggle quote state
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                // End of field
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        // Push the last field
        values.push(currentValue.trim());

        if (values.length !== headers.length) {
            throw new Error(`Invalid CSV format in row ${i + 1}`);
        }

        const rowObj = {};
        headers.forEach((header, index) => {
            // Remove surrounding quotes if present
            let value = values[index];
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/""/g, '"');
            }
            rowObj[header] = value;
        });
        data.push(rowObj);
    }

        return data;
    };

    // Helper function to validate and group CSV data
    const validateAndGroupData = (data) => {
        const topics = {};
        
        data.forEach((row, index) => {
            const topicName = row.topic_name;
            const fieldName = row.field_name;
            
            if (!topicName || !fieldName) {
                throw new Error(`Missing required field in row ${index + 2}`);
            }
            
            if (!topics[topicName]) {
                topics[topicName] = [];
            }
            
            // Check max fields per topic
            if (topics[topicName].length >= 5) {
                throw new Error(`Topic "${topicName}" exceeds maximum limit of 5 fields`);
            }
            
            topics[topicName].push({
                name: fieldName,
                unit: row.result_format || '',
                description: row.description || ''
            });
        });
        
        return topics;
    };

    // Helper function to create topics and fields from CSV data
    const createTopicsFromCSV = (topics) => {
        // Clear existing topics
        topicsContainer.innerHTML = '';
        
        Object.entries(topics).forEach(([topicName, fields]) => {
            const topicSection = createTopicSection();
            topicSection.querySelector('.topic-name').value = topicName;
            
            const dataFieldsContainer = topicSection.querySelector('.data-fields-container');
            dataFieldsContainer.innerHTML = ''; // Clear default field
            
            fields.forEach((field, index) => {
                const fieldRow = createDataFieldRow();
                fieldRow.querySelector('.field-name').value = field.name;
                fieldRow.querySelector('.field-unit').value = field.unit;
                fieldRow.querySelector('.field-description').value = field.description;
                
                // Show/hide remove button based on number of fields
                const removeButton = fieldRow.querySelector('.remove-field');
                removeButton.style.display = fields.length > 1 ? 'block' : 'none';
                
                dataFieldsContainer.appendChild(fieldRow);
            });
            
            // Update add field button state
            const addFieldButton = topicSection.querySelector('.add-field-btn');
            addFieldButton.disabled = fields.length >= 5;
            
            topicsContainer.appendChild(topicSection);
        });
        
        // Show/hide remove topic buttons
        const removeTopicButtons = topicsContainer.getElementsByClassName('remove-topic');
        Array.from(removeTopicButtons).forEach(button => {
            button.style.display = Object.keys(topics).length > 1 ? 'block' : 'none';
        });
    };

    // Handle CSV import
    csvImportInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
            
            const data = parseCSV(content);
            const topics = validateAndGroupData(data);
            createTopicsFromCSV(topics);
            
            // Clear the input
            event.target.value = '';
            errorMessage.style.display = 'none';
        } catch (error) {
            errorMessage.textContent = `CSV Import Error: ${error.message}`;
            errorMessage.style.display = 'block';
            event.target.value = '';
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
                                <div>Cache Read: $${job.costs.cached.cache_read.toFixed(4)}</div>
                                <div>Cache Creation: $${job.costs.cached.cache_creation.toFixed(4)}</div>
                                <div>Total: $${job.costs.cached.total.toFixed(4)}</div>
                            </div>
                            <div class="cost-savings">
                                <div>Total Cost: $${job.costs.total.toFixed(4)}</div>
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

    // Batch mode toggle handler
    if (batchModeToggle) {
        batchModeToggle.addEventListener('change', () => {
            const isBatchMode = batchModeToggle.checked;
            
            // Update UI mode
            document.body.classList.toggle('batch-mode', isBatchMode);
            
            if (isBatchMode) {
                // Switching to batch mode
                // Hide single mode results section
                document.getElementById('single-mode-results').style.display = 'none';
                
                // Show batch mode elements
                batchJobsContainer.style.display = 'block';
                document.querySelector('.batch-options').style.display = 'block';
            } else {
                // Switching to regular mode
                // Show single mode results section
                document.getElementById('single-mode-results').style.display = 'block';
                
                // Hide batch mode elements
                batchJobsContainer.style.display = 'none';
                document.querySelector('.batch-options').style.display = 'none';
                
                // Reset single mode elements
                const responseTable = document.getElementById('response-table');
                const tbody = responseTable.querySelector('tbody');
                tbody.innerHTML = '';
                responseTable.style.display = 'none';
                responseText.style.display = 'none';
                downloadButton.style.display = 'none';
                
                // Reset cost summary
                const costSummary = document.querySelector('.cost-summary');
                costSummary.style.display = 'none';
                document.getElementById('input-tokens').textContent = '0';
                document.getElementById('output-tokens').textContent = '0';
                document.getElementById('cache-read-tokens').textContent = '0';
                document.getElementById('cache-creation-tokens').textContent = '0';
                document.getElementById('input-cost').textContent = '0.0000';
                document.getElementById('output-cost').textContent = '0.0000';
                document.getElementById('cache-read-cost').textContent = '0.0000';
                document.getElementById('cache-creation-cost').textContent = '0.0000';
                document.getElementById('total-cost').textContent = '0.0000';
                
                // Reset batch size warning if present
                const batchSizeWarning = document.querySelector('.batch-size-warning');
                if (batchSizeWarning) {
                    batchSizeWarning.style.display = 'none';
                    batchSizeWarning.textContent = '';
                }
            }
            
            // Update submit button text
            submitButton.textContent = isBatchMode ? 'Submit Batch Job' : 'Submit Query';
            
            // Clear any error messages
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
            
            // Reset loading indicator
            loadingIndicator.style.display = 'none';
            loadingIndicator.textContent = 'Processing...';
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
                                // Get all content blocks
                                const contentBlocks = result.result.message.content;
                                
                                // Extract PDF name from custom_id
                                const pdfName = result.custom_id;
                                
                                // Get topic from job data
                                const [pdfTopic] = job.topics.filter(t => 
                                    result.custom_id.toLowerCase().includes(t.toLowerCase().replace(/\s+/g, '_'))
                                ) || [''];

                                // First concatenate all content
                                let fullText = contentBlocks.map(block => block.text).join('');

                                // Extract tagged content
                                const dataMatch = fullText.match(/<data>([\s\S]*?)<\/data>/);
                                const thinkingMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
                                const resultMatch = fullText.match(/<result>([\s\S]*?)<\/result>/);

                                const query = dataMatch ? dataMatch[1].trim() : '';
                                let processedThinking = thinkingMatch ? thinkingMatch[1].trim() : '';
                                const finalResults = resultMatch ? resultMatch[1].trim() : '';

                                // Build citations map for each text block
                                const citationsMap = new Map();
                                contentBlocks.forEach(block => {
                                    if (block.type === 'text' && block.citations) {
                                        citationsMap.set(block.text.trim(), block.citations[0]);
                                    }
                                });

                                // Process citations
                                let citationCounter = 1;
                                const citationsList = [];

                                // Find cited text in thinking content and add citations
                                for (const [text, citation] of citationsMap) {
                                    if (processedThinking.includes(text)) {
                                        citationsList.push({
                                            number: citationCounter,
                                            text: citation.cited_text,
                                            pages: `${citation.start_page_number}-${citation.end_page_number}`
                                        });

                                        // Add citation reference after the text
                                        processedThinking = processedThinking.replace(
                                            text,
                                            `${text}[${citationCounter}]`
                                        );
                                        citationCounter++;
                                    }
                                }

                                // Format citations with extra line breaks
                                const formattedCitations = citationsList.length > 0 
                                    ? citationsList.map(citation => 
                                        `${citation.number}. Pages ${citation.pages}: ${citation.text}`
                                    ).join('\n\n')
                                    : '';

                                // Use processed thinking with citations and formatted citations
                                const thinkingProcess = processedThinking;
                                const citationsText = formattedCitations || '';

                                // Escape quotes and wrap fields in quotes
                                const escapeField = (field) => {
                                    if (field === null || field === undefined) {
                                        return `""`;
                                    }
                                    return `"${field.toString().replace(/"/g, '""')}"`;
                                };

                                return [
                                    escapeField(pdfName),
                                    escapeField(pdfTopic),
                                    escapeField(query),
                                    escapeField(thinkingProcess),
                                    escapeField(finalResults),
                                    escapeField(citationsText)
                                ].join(',');
                            }
                            return `"${result.custom_id}","","","Error: No content","Error: No content"`;
                        }).join('\n');
                        
                        const header = 'PDF Name,Topic,Query,Thinking Process,Final Results,Citations\n';
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
                        queryLine += ` [Expected result format: ${unitInput.value.trim()}]`;
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

                        // First concatenate all content
                        let fullText = result.content.map(block => block.text).join('');

                        // Extract tagged content
                        const dataMatch = fullText.match(/<data>([\s\S]*?)<\/data>/);
                        const thinkingMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
                        const resultMatch = fullText.match(/<result>([\s\S]*?)<\/result>/);

                        if (!dataMatch || !thinkingMatch || !resultMatch) {
                            // Handle missing tags
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${file.name}</td>
                                <td>${topic.name}</td>
                                <td>${topic.query}</td>
                                <td>No structured data found</td>
                                <td>No structured data found</td>
                                <td>No citations available</td>
                            `;
                            tbody.appendChild(row);
                            continue;
                        }

                        // Extract content
                        const queryContent = dataMatch[1].trim();
                        let processedThinking = thinkingMatch[1].trim();
                        const finalResult = resultMatch[1].trim();

                        // Build citations map for each text block
                        const citationsMap = new Map();
                        result.content.forEach(block => {
                            if (block.type === 'text' && block.citations) {
                                citationsMap.set(block.text.trim(), block.citations[0]);
                            }
                        });

                        // Process citations
                        let citationCounter = 1;
                        const citationsList = [];

                        // Find cited text in thinking content and add citations
                        for (const [text, citation] of citationsMap) {
                            if (processedThinking.includes(text)) {
                                citationsList.push({
                                    number: citationCounter,
                                    text: citation.cited_text,
                                    pages: `${citation.start_page_number}-${citation.end_page_number}`
                                });

                                // Add citation reference after the text
                                processedThinking = processedThinking.replace(
                                    text,
                                    `${text}[${citationCounter}]`
                                );
                                citationCounter++;
                            }
                        }

                        // Format citations as a numbered list with extra line breaks between references
                        const formattedCitations = citationsList.map(citation => 
                            `${citation.number}. Pages ${citation.pages}: ${citation.text}`
                        ).join('\n\n');

                        // Create table row with processed data
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${file.name}</td>
                            <td>${topic.name}</td>
                            <td>${queryContent}</td>
                            <td>${processedThinking}</td>
                            <td>${finalResult}</td>
                            <td>${formattedCitations || 'No citations available'}</td>
                        `;
                        tbody.appendChild(row);
                    } catch (error) {
                        // Add error result to table
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${file.name}</td>
                            <td>${topic.name}</td>
                            <td>${topic.query}</td>
                            <td class="error" colspan="3">Error: ${error.message}</td>
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
