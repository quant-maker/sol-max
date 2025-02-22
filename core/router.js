const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '../pages'); // Ensure pages directory exists

function handleRequest(req, res) {
    try {
        let route = req.url === '/' ? 'home' : req.url.replace(/^\/+|\/+$/g, '');
        let filePath = path.join(PAGES_DIR, `${route}.js`);

        console.log(`Incoming Request: ${req.url} -> Looking for: ${filePath}`);

        if (fs.existsSync(filePath)) {
            try {
                delete require.cache[require.resolve(filePath)]; // Ensure fresh loading
                let page = require(filePath);
                // Check if the module exports a function
                if (typeof page === 'function') {
                    page(req, res);
                } else {
                    throw new Error(`Module at ${filePath} does not export a function.`);
                }
            } catch (error) {
                console.error('Error executing page:', error);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Router: Internal Server Error: ' + error.message);
            }
        } else if (req.url.startsWith('/public/')) {
            serveStaticFile(req, res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        }
    } catch (err) {
        console.error('Router Error:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: ' + err.message);
    }
}

// Serve static files (CSS, JS, images)
function serveStaticFile(req, res) {
    let staticFilePath = path.join(__dirname, '..', req.url);

    fs.readFile(staticFilePath, (err, data) => {
        if (err) {
            console.error('Error reading static file:', err);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File Not Found: ' + err.message);
        } else {
            res.writeHead(200, { 'Content-Type': getContentType(req.url) });
            res.end(data);
        }
    });
}

// Function to detect content types
function getContentType(url) {
    const ext = path.extname(url).toLowerCase();
    const contentTypes = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.eot': 'application/vnd.ms-fontobject',
        '.json': 'application/json',
        '.html': 'text/html'
    };

    return contentTypes[ext] || 'application/octet-stream';
}

module.exports = handleRequest;
