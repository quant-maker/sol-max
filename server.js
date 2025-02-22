const http = require('http');
const handleRequest = require('./core/router.js');

const PORT = 3000;

const server = http.createServer((req, res) => {
    try {
        handleRequest(req, res);
    } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server: Internal Server Error');
    }
});

// Bind to 0.0.0.0 to allow external access via Nginx
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
