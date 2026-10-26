(function () {
    const storageKey = 'smartschool-theme';
    const root = document.documentElement;
    const excludedPages = new Set(['/', '/index.html', '/logout.html']);

    function loadGlobalNavigation() {
        if (excludedPages.has(window.location.pathname)) return;

        const navigationStyles = document.createElement('link');
        navigationStyles.rel = 'stylesheet';
        navigationStyles.href = '/assets/global-navigation.css?v=20261024-7';
        document.head.appendChild(navigationStyles);

        const navigationScript = document.createElement('script');
        navigationScript.src = '/assets/global-navigation.js?v=20261024-6';
        navigationScript.defer = true;
        document.head.appendChild(navigationScript);
    }

    const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

    function readTheme() {
        try {
            const savedTheme = localStorage.getItem(storageKey);
            return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : systemTheme;
        } catch (error) {
            return systemTheme;
        }
    }

    function applyTheme(theme) {
        const selectedTheme = theme === 'dark' ? 'dark' : 'light';
        root.dataset.theme = selectedTheme;
        root.style.colorScheme = selectedTheme;

        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            const isDark = selectedTheme === 'dark';
            button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            button.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            const label = button.querySelector('span');
            const icon = button.querySelector('i');
            if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
            else button.textContent = isDark ? 'Light mode' : 'Dark mode';
            if (icon) icon.className = (icon.classList.contains('fas') ? 'fas fa-' : 'fa-solid fa-') + (isDark ? 'sun' : 'moon');
        });
    }

    applyTheme(readTheme());

    window.addEventListener('storage', function (event) {
        if (event.key === storageKey) applyTheme(event.newValue || systemTheme);
    });

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
            try {
                if (!localStorage.getItem(storageKey)) applyTheme(event.matches ? 'dark' : 'light');
            } catch (error) {
                applyTheme(event.matches ? 'dark' : 'light');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadGlobalNavigation();

        const existingToggle = document.querySelector('#sidebarThemeToggle, #themeToggle');
        if (!existingToggle && excludedPages.has(window.location.pathname)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'global-theme-toggle';
            button.setAttribute('data-theme-toggle', '');
            button.addEventListener('click', function () {
                const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
                try {
                    localStorage.setItem(storageKey, nextTheme);
                } catch (error) {
                    // Theme remains available for this page even when storage is blocked.
                }
            });
            document.body.appendChild(button);
        }
        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            const isDark = root.dataset.theme === 'dark';
            button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            button.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        });
        applyTheme(root.dataset.theme);
    });
})();
