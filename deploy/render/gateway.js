const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 10000;
const STOREFRONT_PORT = 8080;
const ADMIN_PORT = 8081;

const ADMIN_PATHS = [
  '/api/auth',
  '/api/quotations',
  '/api/customers',
  '/api/audits',
  '/api/cms',
  '/api/inventory',
  '/api/navigation',
  '/api/reports',
  '/api/companies',
  '/api/admin'
];

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck for Render & UptimeRobot
  if (req.url === '/healthz' || req.url === '/actuator/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP', timestamp: new Date().toISOString() }));
    return;
  }

  // Decide target backend
  let targetPort = STOREFRONT_PORT;
  let targetPath = req.url;

  if (targetPath.startsWith('/admin-api/')) {
    targetPort = ADMIN_PORT;
    targetPath = targetPath.replace(/^\/admin-api/, '/api');
  } else if (targetPath === '/admin-api') {
    targetPort = ADMIN_PORT;
    targetPath = '/api';
  } else {
    const urlLower = targetPath.toLowerCase();
    const isPortalAdmin = req.headers['x-portal'] === 'admin';
    const isAdminPath = ADMIN_PATHS.some(p => urlLower.startsWith(p));
    if (isPortalAdmin || isAdminPath) {
      targetPort = ADMIN_PORT;
    }
  }

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${targetPort}`
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend API unreachable', targetPort, details: err.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Unified Gateway listening on port ${PORT}`);
  console.log(`  -> Storefront API routing to :${STOREFRONT_PORT}`);
  console.log(`  -> Admin API routing to :${ADMIN_PORT}`);
});
