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
  // Health is only UP when both application processes answer.  The previous
  // unconditional response allowed Render to keep routing traffic while one
  // of the two APIs was dead.
  if (req.url === '/healthz') {
    const check = port => new Promise(resolve => {
      const probe = http.get({ hostname: '127.0.0.1', port, path: '/actuator/health', timeout: 2500 }, response => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 300);
      });
      probe.on('error', () => resolve(false));
      probe.on('timeout', () => { probe.destroy(); resolve(false); });
    });
    Promise.all([check(STOREFRONT_PORT), check(ADMIN_PORT)]).then(([storefront, admin]) => {
      const healthy = storefront && admin;
      res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: healthy ? 'UP' : 'DOWN', storefront, admin }));
    });
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
