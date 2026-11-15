const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 10000;
const STOREFRONT_PORT = 8080;
const ADMIN_PORT = 8081;

const ADMIN_PREFIXES = [
  '/api/quotations',
  '/api/customers',
  '/api/audits',
  '/api/cms',
  '/api/inventory',
  '/api/navigation',
  '/api/reports',
  '/api/companies',
  '/api/admin',
  '/api/banners',
  '/api/products/images',
  '/api/internal',
  '/api/settings'
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
    res.end(JSON.stringify({ status: 'UP', service: 'unified-gateway', timestamp: new Date().toISOString() }));
    return;
  }

  // Debug status for process diagnostics
  if (req.url === '/api/internal/debug-status') {
    const { execSync } = require('child_process');
    let ps = '';
    let adminLog = '';
    let storeLog = '';
    try { ps = execSync('ps aux', { encoding: 'utf8' }); } catch(e){ ps = e.message; }
    try { adminLog = require('fs').readFileSync('/tmp/admin.log', 'utf8').slice(-3000); } catch(e){ adminLog = e.message; }
    try { storeLog = require('fs').readFileSync('/tmp/store.log', 'utf8').slice(-3000); } catch(e){ storeLog = e.message; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', ps, adminLog, storeLog }));
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
    const isAdminPrefix = ADMIN_PREFIXES.some(p => urlLower.startsWith(p));
    if (isPortalAdmin || isAdminPrefix) {
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
