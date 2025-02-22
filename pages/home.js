module.exports = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Home</title>
            <link rel="stylesheet" href="/public/style.css">
        </head>
        <body>
            <div class="container">
                <h1>Welcome to the Home</h1>
                <p>This is a Node.js framework!</p>
                <a href="/home">Go to Home Page</a>
            </div>
            <footer>Powered by Node.js 🚀</footer>
        </body>
        </html>
    `);
};
