const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  process.env.TRIO_PUBLIC_ROOT || 'C:\\Users\\Nikhil Kumar\\Documents\\trio_day_main\\public'
);
const host = process.env.TRIO_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5500);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
  '.map': 'application/json; charset=utf-8'
};

function safeFilePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }

  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidate = path.resolve(root, relative);

  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    return null;
  }
  return candidate;
}

function securityHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Cache-Control': 'no-store'
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Allow': 'GET, HEAD',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end('405 Method Not Allowed');
  }

  const filePath = safeFilePath(req.url || '/');
  if (!filePath) {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end('400 Bad Request');
  }

  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (statErr, stat) => {
    if (!statErr && stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      return serveFile(indexPath, req.method, res);
    }
    serveFile(filePath, req.method, res);
  });
});

function serveFile(filePath, method, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const status = err.code === 'ENOENT' ? 404 : 500;
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(status === 404 ? '404 Not Found' : '500 Internal Server Error');
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, securityHeaders(contentType));
    if (method !== 'HEAD') res.end(data);
    else res.end();
  });
}

server.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
