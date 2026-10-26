(function () {
    const excludedPages = new Set(['/', '/index.html', '/logout.html']);
    const page = window.location.pathname;
    if (excludedPages.has(page)) return;

    function normalizeRole(role) {
        return typeof role === 'string' ? role.trim().replace(/-/g, '_') : '';
    }

    function getHomeHref(role) {
        if (role === 'super_admin') return '/super-admin.html';
        if (role === 'admin') return '/admin.html';
        return '/attendance.html';
    }

    function getRoleLinks(role) {
        if (role === 'super_admin') {
            return [
                { label: 'Dashboard', href: '/admin.html', icon: '⌂', section: 'School menu' },
                { label: 'Super Admin', href: '/super-admin.html', icon: '◆' },
                { label: 'Attendance', href: '/attendance.html', icon: '✓' },
                { label: 'Teachers', href: '/teachers.html', icon: '♙' },
                { label: 'Daily Report', href: '/report.html', icon: '▤' },
                { label: 'Monthly Report', href: '/monthly_report.html', icon: '▦' },
                { label: 'Messages', href: '/messages.html', icon: '✉' },
                { label: 'Settings', href: '/settings.html', icon: '⚙' },
                { label: 'Manage Staff', href: '/admin-builder.html', icon: '♧', section: 'Admin tools' },
                { label: 'Dark mode', action: 'theme', icon: '◐', section: 'Account' },
                { label: 'Log out', action: 'logout', icon: '↪' }
            ];
        }

        if (role === 'admin') {
            return [
                { label: 'Dashboard', href: '/admin.html', icon: '⌂', section: 'School menu' },
                { label: 'Attendance', href: '/attendance.html', icon: '✓' },
                { label: 'Teachers', href: '/teachers.html', icon: '♙' },
                { label: 'Daily Report', href: '/report.html', icon: '▤' },
                { label: 'Monthly Report', href: '/monthly_report.html', icon: '▦' },
                { label: 'Messages', href: '/messages.html', icon: '✉' },
                { label: 'Manage Staff', href: '/admin-builder.html', icon: '♧', section: 'Admin tools' },
                { label: 'Dark mode', action: 'theme', icon: '◐', section: 'Account' },
                { label: 'Log out', action: 'logout', icon: '↪' }
            ];
        }

        return [
            { label: 'Home', href: '/attendance.html', icon: '⌂', section: 'School menu' },
            { label: 'Daily Report', href: '/report.html', icon: '▤' },
            { label: 'Monthly Report', href: '/monthly_report.html', icon: '▦' },
            { label: 'Messages', href: '/messages.html', icon: '✉' },
            { label: 'Dark mode', action: 'theme', icon: '◐', section: 'Account' },
            { label: 'Log out', action: 'logout', icon: '↪' }
        ];
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    function showNavigationError(panel, message, retry) {
        panel.replaceChildren();
        panel.appendChild(createElement('p', 'global-navigation-error', message));
        const retryButton = createElement('button', '', 'Try again');
        retryButton.id = 'global-navigation-retry';
        retryButton.type = 'button';
        retryButton.addEventListener('click', retry);
        panel.appendChild(retryButton);
    }

    async function loadSession() {
        const response = await fetch('/api/session', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        if (response.status === 401 || response.status === 403) return null;
        if (!response.ok) throw new Error(`Session request failed (${response.status})`);
        return response.json();
    }

    function renderNavigation(session) {
        const role = normalizeRole(session.role);
        const roleLinks = getRoleLinks(role);
        const homeHref = getHomeHref(role);

        document.body.classList.add('has-global-navigation');

        const root = createElement('aside');
        root.id = 'global-navigation';
        root.setAttribute('aria-label', 'Main navigation');

        const header = createElement('header', 'global-navigation-header');
        const brand = createElement('a', 'global-navigation-brand', 'SmartSchool');
        brand.href = homeHref;
        const brandIcon = createElement('span', 'global-navigation-brand-icon', '★');
        brandIcon.setAttribute('aria-hidden', 'true');
        brand.prepend(brandIcon);

        const toggle = createElement('button', '', '☰');
        toggle.id = 'global-navigation-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', 'global-navigation-links');
        toggle.setAttribute('aria-label', 'Open navigation');
        header.append(brand, toggle);

        const account = createElement('p', 'global-navigation-user', `${session.name || 'Account'} · ${role.replace(/_/g, ' ')}`);
        const navigation = createElement('nav');
        navigation.id = 'global-navigation-links';
        navigation.setAttribute('aria-label', 'Pages');

        let themeButton;
        function applyTheme(theme, persist) {
            const selectedTheme = theme === 'dark' ? 'dark' : 'light';
            document.documentElement.dataset.theme = selectedTheme;
            document.documentElement.style.colorScheme = selectedTheme;
            if (themeButton) {
                const isDark = selectedTheme === 'dark';
                themeButton.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
                const icon = themeButton.querySelector('.global-navigation-icon');
                if (icon) icon.textContent = isDark ? '☼' : '◐';
                const label = themeButton.querySelector('.global-navigation-label');
                if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
            }
            if (persist) {
                try {
                    localStorage.setItem('smartschool-theme', selectedTheme);
                } catch (error) {
                    console.warn('Could not save the selected theme.', error);
                }
            }
        }

        let currentSection = '';
        roleLinks.forEach(item => {
            if (item.section && item.section !== currentSection) {
                currentSection = item.section;
                navigation.appendChild(createElement('p', 'global-navigation-section', currentSection));
            }

            const link = item.action ? createElement('button') : createElement('a');
            if (item.action) {
                link.type = 'button';
                link.dataset.action = item.action;
            } else {
                link.href = item.href;
                if (page === item.href) link.setAttribute('aria-current', 'page');
            }

            const icon = createElement('span', 'global-navigation-icon', item.icon);
            icon.setAttribute('aria-hidden', 'true');
            const label = createElement('span', 'global-navigation-label', item.label);
            link.append(icon, label);
            navigation.appendChild(link);

            if (item.action === 'theme') themeButton = link;
        });

        root.append(header, account, navigation);
        document.body.appendChild(root);

        applyTheme(document.documentElement.dataset.theme, false);
        window.addEventListener('storage', event => {
            if (event.key === 'smartschool-theme') applyTheme(event.newValue, false);
        });
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                try {
                    if (!localStorage.getItem('smartschool-theme')) applyTheme(event.matches ? 'dark' : 'light', false);
                } catch (error) {
                    applyTheme(event.matches ? 'dark' : 'light', false);
                }
            });
        }

        toggle.addEventListener('click', () => {
            const expanded = root.classList.toggle('global-navigation-expanded');
            toggle.setAttribute('aria-expanded', String(expanded));
            toggle.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
        });

        navigation.addEventListener('click', async event => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;

            if (button.dataset.action === 'theme') {
                const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme, true);
                return;
            }

            if (button.dataset.action === 'logout') {
                button.disabled = true;
                try {
                    const response = await fetch('/logout', { method: 'POST' });
                    if (!response.ok) throw new Error(`Logout request failed (${response.status})`);
                    window.location.assign('/index.html');
                } catch (error) {
                    console.error('Unable to sign out:', error);
                    window.alert('Unable to sign out. Please try again.');
                    button.disabled = false;
                }
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && root.classList.contains('global-navigation-expanded')) {
                root.classList.remove('global-navigation-expanded');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-label', 'Open navigation');
                toggle.focus();
            }
        });
    }

    function start() {
        const loadingPanel = createElement('aside');
        loadingPanel.id = 'global-navigation';
        loadingPanel.setAttribute('aria-label', 'Main navigation');
        loadingPanel.appendChild(createElement('p', 'global-navigation-error', 'Loading navigation…'));
        document.body.appendChild(loadingPanel);

        async function refresh() {
            try {
                const session = await loadSession();
                if (!session) {
                    loadingPanel.remove();
                    return;
                }
                loadingPanel.remove();
                renderNavigation(session);
            } catch (error) {
                console.error('Unable to load system navigation:', error);
                showNavigationError(loadingPanel, 'Navigation could not be loaded. Check your connection and try again.', refresh);
            }
        }

        refresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
