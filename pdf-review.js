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
            Object.entries(pdfFile.extractionResults).forEach(([key, value]) => {
                const resultElement = document.createElement('div');
                resultElement.className = 'extraction-result-item';
                
                const title = document.createElement('h4');
                title.textContent = key;
                
                const content = document.createElement('p');
                content.textContent = value;
                
                resultElement.appendChild(title);
                resultElement.appendChild(content);
                extractionResults.appendChild(resultElement);
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