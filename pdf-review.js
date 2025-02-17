document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('back-to-main');
    
    // Handle back button click - no need to clear session data
    backButton.addEventListener('click', () => {
        // Session data will persist in localStorage
        window.location.href = 'index.html';
    });
}); 