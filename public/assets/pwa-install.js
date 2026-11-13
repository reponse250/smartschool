(function () {
    const installButton = document.getElementById('installAppBtn');
    let installPrompt;

    if ('serviceWorker' in navigator && window.isSecureContext) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .catch(error => console.error('PWA offline support could not be enabled.', error));
        }, { once: true });
    }

    if (!installButton) return;

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = false;
    });

    installButton.addEventListener('click', async () => {
        if (!installPrompt) return;
        installButton.disabled = true;
        try {
            await installPrompt.prompt();
            await installPrompt.userChoice;
        } catch (error) {
            console.error('SmartSchool installation could not be completed.', error);
        } finally {
            installPrompt = null;
            installButton.hidden = true;
            installButton.disabled = false;
        }
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        installButton.hidden = true;
    });
})();
