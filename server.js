const http = require('http');
const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\Nikhil Kumar\\Documents\\trio_day_main\\public';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(root, req.url);
  
  // Handle root path
  if (req.url === '/' || req.url === '') {
    filePath = path.join(root, 'index.html');
  }
  
  // Remove query strings
  filePath = filePath.split('?')[0];
  
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html for directory requests
      if (err.code === 'ENOENT' && !ext) {
        const indexPath = path.join(filePath, 'index.html');
        fs.readFile(indexPath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
      } else {
        res.writeHead(404);
        res.end('404 Not Found');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(5500, () => {
  console.log('Server running on http://localhost:5500');
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});