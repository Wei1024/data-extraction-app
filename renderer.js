let selectedFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('pdf-file');
    const selectedFileText = document.getElementById('selected-file');
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
