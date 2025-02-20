document.addEventListener('DOMContentLoaded', () => {
    const projectsContainer = document.getElementById('projects-container');
    const pdfSelector = document.getElementById('pdf-selector');
    const viewerContainer = document.getElementById('viewerContainer');
    const extractionResults = document.getElementById('extraction-results');
    const statusMessage = document.querySelector('.status-message');
    const errorMessage = document.getElementById('error-message');

    let currentProject = null;
    let currentPdf = null;
    let pdfViewer = null;
    let eventBus = null;

    // Wait for PDF.js to be initialized
    const waitForPdfJs = () => {
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib && window.pdfjsViewer) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.pdfjsLib && window.pdfjsViewer) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);

                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('PDF.js initialization timeout'));
                }, 5000);
            }
        });
    };

    // Initialize the application
    const init = async () => {
        try {
            await waitForPdfJs();
            
            // Initialize event bus
            eventBus = new pdfjsViewer.EventBus();

            // Initialize PDF viewer with event bus
            pdfViewer = new pdfjsViewer.PDFViewer({
                container: viewerContainer,
                viewer: document.getElementById('viewer'),
                eventBus: eventBus,
                textLayerMode: 2, // Enable text layer
                renderInteractiveForms: true,
                spreadMode: 0, // Display single pages
                maxCanvasPixels: 16777216, // Prevent too large canvases
            });

            // Link the viewer to the event bus
            eventBus.on('pagesinit', () => {
                // Set the initial zoom level to fit page width
                pdfViewer.currentScaleValue = 'page-width';
            });

            // Handle page scaling on window resize
            window.addEventListener('resize', () => {
                if (pdfViewer.currentScale) {
                    // Maintain page-width scaling on resize
                    pdfViewer.currentScaleValue = 'page-width';
                }
            });

            // Link the viewer to the global window object for use by event handlers
            window.PDFViewerApplication = { 
                pdfViewer,
                eventBus
            };

            loadProjects();
        } catch (error) {
            console.error('Error initializing PDF.js:', error);
            errorMessage.textContent = 'Error initializing PDF.js: ' + error.message;
        }
    };

    // Load projects from filesystem
    async function loadProjects() {
        try {
            const projects = await window.api.getProjects();
            console.log('Loaded projects:', projects);
            
            projectsContainer.innerHTML = '';

            if (projects && projects.length > 0) {
                // Projects are already sorted by modified date in main process
                projects.forEach(project => {
                    const projectElement = document.createElement('div');
                    projectElement.className = 'project-item';
                    projectElement.textContent = project.name;
                    projectElement.dataset.projectId = project.id;
                    projectElement.addEventListener('click', () => selectProject(project));
                    projectsContainer.appendChild(projectElement);
                });

                // Select the first project (most recent) by default
                selectProject(projects[0]);
            } else {
                statusMessage.textContent = 'No projects available';
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            errorMessage.textContent = 'Error loading projects: ' + error.message;
        }
    }

    // Select a project and load its PDFs
    function selectProject(project) {
        currentProject = project;
        
        // Update UI to show selected project
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.projectId === project.id) {
                item.classList.add('active');
            }
        });

        // Load PDFs for the project
        loadProjectPdfs(project);
        
        // Clear current results
        extractionResults.innerHTML = '';
        statusMessage.textContent = `Selected project: ${project.name}`;
    }

    // Load PDFs for the selected project
    function loadProjectPdfs(project) {
        pdfSelector.innerHTML = '<option value="">Select a PDF</option>';
        
        if (project.pdfs && project.pdfs.length > 0) {
            project.pdfs.forEach(pdf => {
                const option = document.createElement('option');
                option.value = pdf.path;
                option.textContent = pdf.name;
                pdfSelector.appendChild(option);
            });

            // Select the first PDF by default
            if (project.pdfs[0]) {
                pdfSelector.value = project.pdfs[0].path;
                loadPdf(project.pdfs[0]);
            }
        }
    }

    // Load and display PDF
    async function loadPdf(pdfFile) {
        currentPdf = pdfFile;
        
        try {
            if (!window.pdfjsLib) {
                throw new Error('PDF.js library not loaded');
            }

            const loadingTask = pdfjsLib.getDocument(pdfFile.path);
            const pdfDocument = await loadingTask.promise;
            
            // Set the document in the viewer
            await pdfViewer.setDocument(pdfDocument);

            // Ensure proper scaling after document is loaded
            pdfViewer.currentScaleValue = 'page-width';

            // Load extraction results
            loadExtractionResults(pdfFile);
            
            statusMessage.textContent = `Loaded PDF: ${pdfFile.name}`;
        } catch (error) {
            console.error('Error loading PDF:', error);
            errorMessage.textContent = `Error loading PDF: ${error.message}`;
        }
    }

    // Load and display extraction results
    function loadExtractionResults(pdfFile) {
        extractionResults.innerHTML = '';
        
        if (pdfFile.extractionResults) {
            Object.entries(pdfFile.extractionResults).forEach(([topic, data]) => {
                const topicContainer = document.createElement('div');
                topicContainer.className = 'topic-results-container';
                
                // Create topic header with toggle button
                const topicHeader = document.createElement('div');
                topicHeader.className = 'extraction-topic-header';
                
                const titleContainer = document.createElement('div');
                titleContainer.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                
                const topicTitle = document.createElement('h3');
                topicTitle.style.cssText = 'margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                topicTitle.textContent = topic;
                titleContainer.appendChild(topicTitle);
                
                const toggleButton = document.createElement('button');
                toggleButton.className = 'topic-toggle';
                toggleButton.innerHTML = '▼';
                toggleButton.style.flexShrink = '0';
                
                topicHeader.appendChild(titleContainer);
                topicHeader.appendChild(toggleButton);
                topicContainer.appendChild(topicHeader);
                
                // Create results container
                const resultsContainer = document.createElement('div');
                resultsContainer.className = 'results-container';
                
                // Convert to array if it's not already an array
                const dataArray = Array.isArray(data) ? data : [data];
                
                // Sort results by timestamp, newest first
                const sortedArray = dataArray.sort((a, b) => {
                    const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
                    const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
                    return dateB - dateA;
                });
                
                // Display each result for this topic
                sortedArray.forEach((data, index) => {
                    const resultCard = document.createElement('div');
                    resultCard.className = 'result-card';
                    
                    // Add timestamp if available
                    if (data.timestamp) {
                        const timestampSection = document.createElement('div');
                        timestampSection.className = 'timestamp-badge';
                        timestampSection.textContent = new Date(data.timestamp).toLocaleString();
                        resultCard.appendChild(timestampSection);
                    }
                    
                    // Create data field container
                    const dataFieldContainer = document.createElement('div');
                    dataFieldContainer.className = 'data-field-container';
                    
                    // Create query section
                    const querySection = document.createElement('div');
                    querySection.className = 'query-section';
                    const queryLabel = document.createElement('div');
                    queryLabel.className = 'section-label';
                    queryLabel.textContent = 'Query';
                    const queryContent = document.createElement('div');
                    queryContent.className = 'section-content';
                    queryContent.textContent = data.query;
                    querySection.appendChild(queryLabel);
                    querySection.appendChild(queryContent);
                    dataFieldContainer.appendChild(querySection);
                    
                    // Create result section
                    const resultSection = document.createElement('div');
                    resultSection.className = 'result-section';
                    const resultLabel = document.createElement('div');
                    resultLabel.className = 'section-label';
                    resultLabel.textContent = 'Result';
                    const resultContent = document.createElement('div');
                    resultContent.className = 'section-content';
                    resultContent.textContent = data.result;
                    resultSection.appendChild(resultLabel);
                    resultSection.appendChild(resultContent);
                    dataFieldContainer.appendChild(resultSection);
                    
                    // Create human review section
                    const reviewSection = document.createElement('div');
                    reviewSection.className = 'review-section';
                    const reviewLabel = document.createElement('div');
                    reviewLabel.className = 'section-label';
                    reviewLabel.textContent = 'Human Review';
                    
                    // Create review input container
                    const reviewInputContainer = document.createElement('div');
                    reviewInputContainer.className = 'review-input-container';
                    
                    // Create review input
                    const reviewInput = document.createElement('textarea');
                    reviewInput.className = 'review-input';
                    reviewInput.placeholder = 'Enter your review here...';
                    reviewInput.value = data.human_review || ''; // Load existing review if any
                    
                    // Create agree button
                    const agreeButton = document.createElement('button');
                    agreeButton.className = 'agree-button';
                    agreeButton.innerHTML = '<span class="agree-icon">✓</span> Agree with AI';
                    agreeButton.addEventListener('click', () => {
                        reviewInput.value = data.result;
                        saveReview(data, reviewInput.value, agreeButton);
                    });
                    
                    // Create save button
                    const saveButton = document.createElement('button');
                    saveButton.className = 'save-button';
                    saveButton.textContent = 'Save Review';
                    saveButton.addEventListener('click', () => {
                        saveReview(data, reviewInput.value, saveButton);
                    });
                    
                    // Add buttons to container
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'review-buttons';
                    buttonContainer.appendChild(agreeButton);
                    buttonContainer.appendChild(saveButton);
                    
                    reviewInputContainer.appendChild(reviewInput);
                    reviewInputContainer.appendChild(buttonContainer);
                    
                    reviewSection.appendChild(reviewLabel);
                    reviewSection.appendChild(reviewInputContainer);
                    
                    // Add all sections to container
                    dataFieldContainer.appendChild(querySection);
                    dataFieldContainer.appendChild(resultSection);
                    dataFieldContainer.appendChild(reviewSection);
                    
                    resultCard.appendChild(dataFieldContainer);
                    
                    // Create expandable sections container
                    const expandableSections = document.createElement('div');
                    expandableSections.className = 'expandable-sections';
                    
                    // Create thinking process section with enhanced styling
                    const thinkingSection = document.createElement('div');
                    thinkingSection.className = 'expandable-section thinking-section';
                    const thinkingToggle = document.createElement('button');
                    thinkingToggle.className = 'expandable-toggle';
                    thinkingToggle.innerHTML = '<span class="toggle-icon">▶</span> Thinking Process';
                    const thinkingContent = document.createElement('div');
                    thinkingContent.className = 'expandable-content thinking-content';
                    thinkingContent.style.display = 'none';
                    
                    // Process thinking text to create interactive citations
                    let thinkingText = data.thinking || '';
                    const citationMap = new Map();
                    let citationCounter = 1;
                    
                    // Extract citations from the thinking text
                    const citationRegex = /\[(\d+)\]/g;
                    const citations = (data.citations || '').split('\n\n');
                    let match;
                    
                    while ((match = citationRegex.exec(thinkingText)) !== null) {
                        const citationNumber = match[1];
                        const citation = citations[parseInt(citationNumber) - 1];
                        if (citation) {
                            citationMap.set(citationNumber, citation);
                        }
                    }
                    
                    // Replace citation numbers with interactive spans
                    thinkingText = thinkingText.replace(citationRegex, (match, number) => {
                        return `<span class="citation-link" data-citation="${number}">[${number}]</span>`;
                    });
                    
                    // Create structured thinking content
                    const thinkingSteps = thinkingText.split('\n\n').map(step => {
                        if (step.trim()) {
                            return `<div class="thinking-step">${step}</div>`;
                        }
                        return '';
                    }).join('');
                    
                    thinkingContent.innerHTML = thinkingSteps;
                    
                    // Add click handlers for citations
                    thinkingContent.querySelectorAll('.citation-link').forEach(link => {
                        link.addEventListener('click', () => {
                            const citationNumber = link.dataset.citation;
                            const citation = citationMap.get(citationNumber);
                            if (citation) {
                                // Extract page numbers from citation
                                const pageMatch = citation.match(/Pages (\d+)/);
                                if (pageMatch) {
                                    const pageNumber = parseInt(pageMatch[1]);
                                    scrollToPage(pageNumber);
                                }
                                // Show citation tooltip
                                showCitationTooltip(link, citation);
                            }
                        });
                    });
                    
                    thinkingSection.appendChild(thinkingToggle);
                    thinkingSection.appendChild(thinkingContent);
                    expandableSections.appendChild(thinkingSection);
                    
                    // Create citations section with enhanced styling
                    const citationsSection = document.createElement('div');
                    citationsSection.className = 'expandable-section citations-section';
                    const citationsToggle = document.createElement('button');
                    citationsToggle.className = 'expandable-toggle';
                    citationsToggle.innerHTML = '<span class="toggle-icon">▶</span> Citations';
                    const citationsContent = document.createElement('div');
                    citationsContent.className = 'expandable-content citations-content';
                    citationsContent.style.display = 'none';
                    
                    // Create structured citations content
                    const citationsList = (data.citations ? data.citations.split('\n\n') : []).map((citation, index) => {
                        if (citation && citation.trim()) {
                            const pageMatch = citation.match(/Pages (\d+)/);
                            const pageNumber = pageMatch ? pageMatch[1] : null;
                            return `
                                <div class="citation-item" data-page="${pageNumber}">
                                    <div class="citation-number">[${index + 1}]</div>
                                    <div class="citation-text">${citation}</div>
                                    ${pageNumber ? `<button class="goto-page-btn" data-page="${pageNumber}">Go to Page ${pageNumber}</button>` : ''}
                                </div>
                            `;
                        }
                        return '';
                    }).join('');
                    
                    citationsContent.innerHTML = citationsList;
                    
                    // Add click handlers for "Go to Page" buttons
                    citationsContent.querySelectorAll('.goto-page-btn').forEach(button => {
                        button.addEventListener('click', () => {
                            const pageNumber = parseInt(button.dataset.page);
                            scrollToPage(pageNumber);
                        });
                    });
                    
                    citationsSection.appendChild(citationsToggle);
                    citationsSection.appendChild(citationsContent);
                    expandableSections.appendChild(citationsSection);
                    
                    resultCard.appendChild(expandableSections);
                    resultsContainer.appendChild(resultCard);
                    
                    // Add toggle functionality for expandable sections
                    [thinkingToggle, citationsToggle].forEach(toggle => {
                        toggle.addEventListener('click', () => {
                            const content = toggle.nextElementSibling;
                            const isHidden = content.style.display === 'none';
                            content.style.display = isHidden ? 'block' : 'none';
                            toggle.querySelector('.toggle-icon').textContent = isHidden ? '▼' : '▶';
                        });
                    });
                });
                
                topicContainer.appendChild(resultsContainer);
                
                // Add topic toggle functionality
                toggleButton.addEventListener('click', () => {
                    const isHidden = resultsContainer.style.display === 'none';
                    resultsContainer.style.display = isHidden ? 'block' : 'none';
                    toggleButton.textContent = isHidden ? '▼' : '▶';
                });
                
                extractionResults.appendChild(topicContainer);
            });
        } else {
            extractionResults.innerHTML = '<p>No extraction results available</p>';
        }
    }

    // Helper function to show citation tooltip
    function showCitationTooltip(element, citation) {
        const tooltip = document.createElement('div');
        tooltip.className = 'citation-tooltip';
        tooltip.textContent = citation;
        
        // Position the tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.position = 'absolute';
        tooltip.style.top = `${rect.bottom + 5}px`;
        tooltip.style.left = `${rect.left}px`;
        
        document.body.appendChild(tooltip);
        
        // Remove tooltip when clicking outside
        const removeTooltip = (e) => {
            if (!tooltip.contains(e.target) && e.target !== element) {
                tooltip.remove();
                document.removeEventListener('click', removeTooltip);
            }
        };
        
        document.addEventListener('click', removeTooltip);
    }

    // Function to scroll to specific page
    function scrollToPage(pageNumber) {
        if (!pdfViewer || !pageNumber) return;
        
        // Ensure page number is within bounds
        if (pageNumber < 1 || pageNumber > pdfViewer.pagesCount) return;

        // Scroll to the page
        pdfViewer.currentPageNumber = pageNumber;
        
        // Get the page element
        const pageElement = document.querySelector(`[data-page-number="${pageNumber}"]`);
        if (pageElement) {
            // Scroll the page into view
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Add highlight effect
            pageElement.classList.add('page-highlight');
            
            // Remove highlight class after animation
            setTimeout(() => {
                pageElement.classList.remove('page-highlight');
            }, 2000);
        }
    }

    // Add event listener for PDF selection
    pdfSelector.addEventListener('change', () => {
        const selectedPdf = currentProject.pdfs.find(pdf => pdf.path === pdfSelector.value);
        if (selectedPdf) {
            loadPdf(selectedPdf);
        }
    });

    // Function to save review
    async function saveReview(data, reviewText, saveButton) {
        try {
            // Save to the data object
            data.human_review = reviewText;
            data.review_timestamp = new Date().toISOString();
            
            // Update the current PDF's extraction results
            if (currentPdf && currentPdf.extractionResults) {
                // Find the topic and update the data in the extraction results
                for (const [topic, topicData] of Object.entries(currentPdf.extractionResults)) {
                    const dataArray = Array.isArray(topicData) ? topicData : [topicData];
                    const updatedData = dataArray.map(item => {
                        if (item === data) {
                            return {
                                ...item,
                                human_review: reviewText,
                                review_timestamp: data.review_timestamp
                            };
                        }
                        return item;
                    });
                    currentPdf.extractionResults[topic] = updatedData;
                }

                // Call the main process to save the updated results
                await window.api.saveExtractionResults(currentProject.id, currentPdf.name, currentPdf.extractionResults);
                
                // Show success feedback
                saveButton.classList.add('success');
                saveButton.textContent = 'Saved!';
                setTimeout(() => {
                    saveButton.classList.remove('success');
                    saveButton.textContent = 'Save Review';
                }, 2000);
            } else {
                throw new Error('Current PDF or extraction results not found');
            }
        } catch (error) {
            console.error('Error saving review:', error);
            saveButton.classList.add('error');
            saveButton.textContent = 'Error Saving';
            setTimeout(() => {
                saveButton.classList.remove('error');
                saveButton.textContent = 'Save Review';
            }, 2000);
        }
    }

    // Initialize the application
    init();
}); 