    function toggleMenu() {
    const sideMenu = document.querySelector('.side-menu');
    const overlay = document.querySelector('.overlay');
    const isVisible = sideMenu.style.left == "0px";

    sideMenu.style.left = isVisible ? "-250px" : "0px";
    overlay.style.display = isVisible ? "none" : "block";
}

document.addEventListener('DOMContentLoaded', function() {
    // Поиск кнопки выхода в документе
    const logoutButton = document.querySelector('.logout');

    // Обработчик клика на кнопку выхода
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            // Очистка localStorage
            localStorage.clear();

            // Переадресация на страницу аутентификации
            window.location.href = 'auth.html';
        });
    }
});