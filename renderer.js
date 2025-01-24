let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('pdf-file');
    const selectedFileText = document.getElementById('selected-file');
    const queryText = document.getElementById('query-text');
    const submitButton = document.getElementById('submit-query');
    const responseText = document.getElementById('response-text');
    const loadingIndicator = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');

    // Handle file selection
    fileInput.addEventListener('change', (event) => {
        selectedFile = event.target.files[0];
        if (selectedFile) {
            selectedFileText.textContent = `Selected file: ${selectedFile.name}`;
            // Validate file type
            if (!selectedFile.type.includes('pdf')) {
                errorMessage.textContent = 'Please select a PDF file';
                errorMessage.style.display = 'block';
                selectedFile = null;
                return;
            }
            errorMessage.style.display = 'none';
        } else {
            selectedFileText.textContent = '';
        }
    });

    // Handle form submission
    submitButton.addEventListener('click', async () => {
        if (!selectedFile) {
            errorMessage.textContent = 'Please select a PDF file';
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
            responseText.textContent = '';

            const response = await window.api.queryPDF(selectedFile, queryText.value.trim());
            responseText.textContent = response;
        } catch (error) {
            errorMessage.textContent = `Error: ${error.message}`;
            errorMessage.style.display = 'block';
            responseText.textContent = '';
        } finally {
            loadingIndicator.style.display = 'none';
            submitButton.disabled = false;
        }
    });
});
