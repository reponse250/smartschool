(function () {
    const storageKey = 'smartschool-theme';
    const root = document.documentElement;
    const excludedPages = new Set(['/', '/index.html', '/logout.html']);

    window.confirmAction = function (options = {}) {
        return new Promise(resolve => {
            const dialog = document.createElement('dialog');
            dialog.className = 'smartschool-confirm-dialog';
            dialog.setAttribute('aria-labelledby', 'smartschool-confirm-title');
            dialog.setAttribute('aria-describedby', 'smartschool-confirm-message smartschool-confirm-detail');
            dialog.innerHTML = `
                <div class="smartschool-confirm-content">
                    <button class="smartschool-confirm-close" type="button" aria-label="Close confirmation">&times;</button>
                    <div class="smartschool-confirm-icon" aria-hidden="true">!</div>
                    <h2 id="smartschool-confirm-title"></h2>
                    <p id="smartschool-confirm-message"></p>
                    <p id="smartschool-confirm-detail" class="smartschool-confirm-detail"></p>
                    <form method="dialog" class="smartschool-confirm-actions">
                        <button class="smartschool-confirm-cancel" type="submit" value="cancel">Cancel</button>
                        <button class="smartschool-confirm-submit" type="submit" value="confirm"></button>
                    </form>
                </div>
            `;

            const styles = document.createElement('style');
            styles.textContent = `
                .smartschool-confirm-dialog {
                    width: min(440px, calc(100% - 32px));
                    max-width: none;
                    padding: 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 18px;
                    color: #172338;
                    background: #fff;
                    box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
                    font: inherit;
                }
                .smartschool-confirm-dialog::backdrop { background: rgba(15, 23, 42, .58); backdrop-filter: blur(3px); }
                .smartschool-confirm-content { position: relative; padding: 28px 30px 24px; text-align: center; }
                .smartschool-confirm-close {
                    position: absolute; top: 10px; right: 12px; padding: 2px 8px;
                    color: #64748b; background: transparent; font-size: 26px; line-height: 1;
                }
                .smartschool-confirm-icon {
                    display: grid; width: 68px; height: 68px; place-items: center; margin: 0 auto 14px;
                    border: 6px solid #ffedb5; border-radius: 50%; background: #ffb812;
                    color: #172338; font-size: 40px; font-weight: 800;
                }
                .smartschool-confirm-dialog h2 { margin: 0 0 8px; color: #172338 !important; font-size: 24px; letter-spacing: -.04em; }
                .smartschool-confirm-dialog p { margin: 0; color: #172338 !important; line-height: 1.5; }
                .smartschool-confirm-dialog .smartschool-confirm-detail { padding-top: 10px; color: #64748b !important; font-size: 14px; }
                .smartschool-confirm-actions { display: flex; justify-content: center; gap: 10px; margin-top: 24px; }
                .smartschool-confirm-actions button { min-width: 130px; min-height: 42px; border-radius: 9px; font: inherit; font-weight: 700; cursor: pointer; }
                .smartschool-confirm-cancel { border: 1px solid #cbd5e1; background: #f8fafc; color: #172338; }
                .smartschool-confirm-submit { border: 1px solid #dc2626; background: #dc2626; color: #fff; }
                .smartschool-confirm-dialog button:focus-visible { outline: 3px solid #60a5fa; outline-offset: 3px; }
                @media (max-width: 480px) {
                    .smartschool-confirm-content { padding: 28px 18px 20px; }
                    .smartschool-confirm-actions button { min-width: 0; flex: 1; }
                }
                @media (prefers-reduced-motion: no-preference) {
                    .smartschool-confirm-dialog[open] { animation: smartschool-confirm-in .16s ease-out; }
                    @keyframes smartschool-confirm-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
                }
            `;

            const title = dialog.querySelector('#smartschool-confirm-title');
            const message = dialog.querySelector('#smartschool-confirm-message');
            const detail = dialog.querySelector('#smartschool-confirm-detail');
            const cancel = dialog.querySelector('.smartschool-confirm-cancel');
            const submit = dialog.querySelector('.smartschool-confirm-submit');
            const close = dialog.querySelector('.smartschool-confirm-close');
            title.textContent = options.title || 'Confirm Action';
            message.textContent = options.message || 'Are you sure you want to continue?';
            detail.textContent = options.detail || '';
            detail.hidden = !options.detail;
            cancel.textContent = options.cancelText || 'Cancel';
            submit.textContent = options.confirmText || 'Confirm';
            close.addEventListener('click', () => dialog.close('cancel'));
            dialog.addEventListener('click', event => {
                if (event.target === dialog) dialog.close('cancel');
            });
            dialog.addEventListener('close', () => {
                resolve(dialog.returnValue === 'confirm');
                dialog.remove();
                styles.remove();
            }, { once: true });

            document.head.appendChild(styles);
            document.body.appendChild(dialog);
            dialog.showModal();
            cancel.focus();
        });
    };

    window.smartSchoolLogout = async function (button, options = {}) {
        if (options.confirm !== false) {
            const confirmed = await window.confirmAction({
                title: 'Confirm Action',
                message: 'Are you sure you want to log out of the system?',
                detail: 'You will be signed out and redirected to the login page.',
                confirmText: 'Log Out'
            });
            if (!confirmed) return false;
        }

        if (button) button.disabled = true;
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || `Logout request failed (${response.status})`);
            }
            window.location.replace('/');
            return true;
        } catch (error) {
            console.error('Unable to sign out:', error);
            window.alert('Unable to sign out. Please try again.');
            if (button) button.disabled = false;
            return false;
        }
    };

    function loadGlobalNavigation() {
        if (excludedPages.has(window.location.pathname)) return;

        const navigationStyles = document.createElement('link');
        navigationStyles.rel = 'stylesheet';
        navigationStyles.href = '/assets/global-navigation.css?v=20261111-2';
        document.head.appendChild(navigationStyles);

        const navigationScript = document.createElement('script');
        navigationScript.src = '/assets/global-navigation.js?v=20261111-1';
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
