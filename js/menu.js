document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const sideMenu = document.querySelector('.side-menu');
    const menuBackdrop = document.querySelector('.menu-backdrop');
    const menuItems = document.querySelectorAll('.menu-item');

    // Toggle menu
    const toggleMenu = () => {
        sideMenu.classList.toggle('open');
        menuBackdrop.classList.toggle('visible');
    };

    // Close menu
    const closeMenu = () => {
        sideMenu.classList.remove('open');
        menuBackdrop.classList.remove('visible');
    };

    // Event listeners
    menuToggle.addEventListener('click', toggleMenu);
    menuBackdrop.addEventListener('click', closeMenu);

    // Set active menu item based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    menuItems.forEach(item => {
        const itemPage = item.getAttribute('href');
        if (itemPage === currentPage) {
            item.classList.add('active');
        }
    });

    // Handle Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });
}); 