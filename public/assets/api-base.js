(function () {
    const isPackagedApp = window.location.protocol === 'file:' ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'app:' ||
        window.location.hostname === 'localhost';

    if (!isPackagedApp) return;

    const apiBase = 'https://smartschool-o73k.onrender.com';
    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        const requestUrl = input instanceof Request ? input.url : String(input);
        let url;
        try {
            url = new URL(requestUrl, window.location.href);
        } catch (error) {
            return originalFetch(input, init);
        }

        if (url.origin !== window.location.origin) {
            return originalFetch(input, init);
        }

        const target = new URL(`${url.pathname}${url.search}${url.hash}`, apiBase);
        const options = { ...init, credentials: (init && init.credentials) || 'include' };
        const request = input instanceof Request
            ? new Request(target.href, input)
            : target.href;

        return originalFetch(request, options);
    };
})();
