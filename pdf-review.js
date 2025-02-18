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
                projects.forEach(project => {
                    const projectElement = document.createElement('div');
                    projectElement.className = 'project-item';
                    projectElement.textContent = project.name;
                    projectElement.dataset.projectId = project.id;

                    projectElement.addEventListener('click', () => selectProject(project));
                    projectsContainer.appendChild(projectElement);
                });

                // Select the most recent project by default
                selectProject(projects[projects.length - 1]);
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
                // Create a container for this topic
                const topicContainer = document.createElement('div');
                topicContainer.className = 'topic-results-container';
                
                // Create topic header with toggle button
                const topicHeader = document.createElement('div');
                topicHeader.className = 'topic-header';
                
                const topicTitle = document.createElement('h3');
                topicTitle.textContent = topic;
                
                const toggleButton = document.createElement('button');
                toggleButton.className = 'topic-toggle';
                toggleButton.innerHTML = '▼';
                
                topicHeader.appendChild(topicTitle);
                topicHeader.appendChild(toggleButton);
                topicContainer.appendChild(topicHeader);
                
                // Create results container
                const resultsContainer = document.createElement('div');
                resultsContainer.className = 'results-container';
                
                // Convert to array if it's not already an array (for backward compatibility)
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
                    resultCard.appendChild(querySection);
                    
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
                    resultCard.appendChild(resultSection);
                    
                    // Create expandable sections container
                    const expandableSections = document.createElement('div');
                    expandableSections.className = 'expandable-sections';
                    
                    // Create thinking process section
                    const thinkingSection = document.createElement('div');
                    thinkingSection.className = 'expandable-section';
                    const thinkingToggle = document.createElement('button');
                    thinkingToggle.className = 'expandable-toggle';
                    thinkingToggle.innerHTML = '<span class="toggle-icon">▶</span> Thinking Process';
                    const thinkingContent = document.createElement('div');
                    thinkingContent.className = 'expandable-content';
                    thinkingContent.style.display = 'none';
                    thinkingContent.innerHTML = data.thinking;
                    
                    thinkingToggle.addEventListener('click', () => {
                        const isHidden = thinkingContent.style.display === 'none';
                        thinkingContent.style.display = isHidden ? 'block' : 'none';
                        thinkingToggle.querySelector('.toggle-icon').textContent = isHidden ? '▼' : '▶';
                    });
                    
                    thinkingSection.appendChild(thinkingToggle);
                    thinkingSection.appendChild(thinkingContent);
                    expandableSections.appendChild(thinkingSection);
                    
                    // Create citations section if available
                    if (data.citations) {
                        const citationsSection = document.createElement('div');
                        citationsSection.className = 'expandable-section';
                        const citationsToggle = document.createElement('button');
                        citationsToggle.className = 'expandable-toggle';
                        citationsToggle.innerHTML = '<span class="toggle-icon">▶</span> Citations';
                        const citationsContent = document.createElement('div');
                        citationsContent.className = 'expandable-content';
                        citationsContent.style.display = 'none';
                        citationsContent.innerHTML = data.citations;
                        
                        citationsToggle.addEventListener('click', () => {
                            const isHidden = citationsContent.style.display === 'none';
                            citationsContent.style.display = isHidden ? 'block' : 'none';
                            citationsToggle.querySelector('.toggle-icon').textContent = isHidden ? '▼' : '▶';
                        });
                        
                        citationsSection.appendChild(citationsToggle);
                        citationsSection.appendChild(citationsContent);
                        expandableSections.appendChild(citationsSection);
                    }
                    
                    resultCard.appendChild(expandableSections);
                    resultsContainer.appendChild(resultCard);
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

    // Add event listener for PDF selection
    pdfSelector.addEventListener('change', () => {
        const selectedPdf = currentProject.pdfs.find(pdf => pdf.path === pdfSelector.value);
        if (selectedPdf) {
            loadPdf(selectedPdf);
        }
    });

    // Initialize the application
    init();
}); 