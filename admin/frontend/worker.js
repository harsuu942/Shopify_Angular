export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // First try serving product images directly from Cloudflare Assets
    if (url.pathname.startsWith('/api/product-images/') || url.pathname.startsWith('/product-images/')) {
      const filename = url.pathname.replace(/^\/api\/product-images\//, '').replace(/^\/product-images\//, '');
      const assetUrl = new URL(`/product-images/${filename}`, request.url);
      try {
        const assetResp = await env.ASSETS.fetch(new Request(assetUrl, request));
        const assetType = assetResp?.headers.get('content-type') || '';
        if (assetResp && assetResp.status === 200 && (assetType.startsWith('image/') || assetType.startsWith('application/pdf'))) {
          const res = new Response(assetResp.body, assetResp);
          res.headers.set('Access-Control-Allow-Origin', '*');
          return res;
        }
      } catch (_) {}

      // The static-assets binding uses SPA fallback and returns index.html with
      // HTTP 200 for unknown files. If the response above was not an actual
      // image, continue to Render where dynamic uploads are stored.
    }

    // Forward API and actuator requests to Render Admin Backend with automatic fallback
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const primaryOrigin = 'https://hearth-admin-backend.onrender.com';
      const fallbackOrigin = 'https://hearth-backend-0bbo.onrender.com';

      // Safely buffer request body for POST/PUT/PATCH to prevent stream-locking errors
      let body = undefined;
      if (!['GET', 'HEAD'].includes(request.method)) {
        try {
          body = await request.arrayBuffer();
        } catch (_) {
          body = undefined;
        }
      }

      const forwardRequest = async (origin) => {
        const targetUrl = new URL(url.pathname + url.search, origin);
        const headers = new Headers(request.headers);
        headers.set('host', targetUrl.host);
        headers.set('x-forwarded-host', url.host);
        headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
        headers.set('x-portal', 'admin');

        return fetch(targetUrl.toString(), {
          method: request.method,
          headers: headers,
          body: body,
          redirect: 'follow',
          duplex: 'half'
        });
      };

      try {
        let resp = await forwardRequest(primaryOrigin);
        if (resp.status === 502 || resp.status === 503 || resp.status === 504 || (resp.status === 200 && resp.headers.get('content-type')?.includes('text/html') && !url.pathname.includes('/actuator/'))) {
          const text = await resp.clone().text();
          if (text.includes('Service Suspended') || text.includes('no-deploy') || text.includes('Backend API unreachable')) {
            resp = await forwardRequest(fallbackOrigin);
          }
        }
        if (resp.status >= 500) {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('text/html')) {
            return new Response(JSON.stringify({
              message: 'The admin backend is waking up or deploying on Render. Please try again in a few moments.',
              error: 'Backend service unavailable',
              status: resp.status
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        return resp;
      } catch (err) {
        try {
          return await forwardRequest(fallbackOrigin);
        } catch (fallbackErr) {
          return new Response(JSON.stringify({ 
            message: 'The backend service is waking up from cold start on Render. Please try again in a few seconds.',
            error: 'Backend temporarily unreachable',
            details: fallbackErr.message 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Never retain the SPA shell: each refresh must discover the newest hashed
    // JavaScript bundle. Immutable image/script assets keep their normal cache.
    const assetResponse = await env.ASSETS.fetch(request);
    const assetType = assetResponse.headers.get('content-type') || '';
    if (assetType.includes('text/html')) {
      const freshHtml = new Response(assetResponse.body, assetResponse);
      freshHtml.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      freshHtml.headers.set('Pragma', 'no-cache');
      freshHtml.headers.set('Expires', '0');
      return freshHtml;
    }
    return assetResponse;
  },

  // Keep-alive cron trigger to prevent Render backends from sleeping
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.allSettled([
        fetch('https://hearth-admin-backend.onrender.com/actuator/health'),
        fetch('https://hearth-backend-0bbo.onrender.com/actuator/health')
      ]).then(results => {
        console.log('Admin keep-alive pings sent. Results:', results.map(r => r.status));
      }).catch(err => console.error('Admin keep-alive ping error:', err))
    );
  }
};
