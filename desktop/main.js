const { app, BrowserWindow, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([{
    scheme: 'app',
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
    }
}]);

const publicDirectory = path.resolve(__dirname, '..', 'public');
const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json'
};

function isWithinPublicDirectory(filePath) {
    return filePath === publicDirectory ||
        filePath.startsWith(`${publicDirectory}${path.sep}`);
}

async function serveAppFile(request) {
    const url = new URL(request.url);
    if (url.hostname !== 'localhost' || !['GET', 'HEAD'].includes(request.method)) {
        return new Response('Not found', { status: 404 });
    }

    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch (error) {
        return new Response('Bad request', { status: 400 });
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.resolve(publicDirectory, relativePath);
    if (!isWithinPublicDirectory(filePath)) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const contents = await fs.readFile(filePath);
        return new Response(request.method === 'HEAD' ? null : contents, {
            headers: {
                'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
                'X-Content-Type-Options': 'nosniff'
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            return new Response('Not found', { status: 404 });
        }
        console.error('Unable to load application file:', error);
        return new Response('Application file could not be loaded', { status: 500 });
    }
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
        if (new URL(url).origin !== 'app://localhost') event.preventDefault();
    });
    window.once('ready-to-show', () => window.show());
    window.loadURL('app://localhost/index.html');
}

app.whenReady().then(async () => {
    protocol.handle('app', serveAppFile);
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
