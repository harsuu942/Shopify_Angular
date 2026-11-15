export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // First try serving product images directly from Cloudflare Assets
    if (url.pathname.startsWith('/api/product-images/') || url.pathname.startsWith('/product-images/')) {
      const filename = url.pathname.replace(/^\/api\/product-images\//, '').replace(/^\/product-images\//, '');
      const assetUrl = new URL(`/product-images/${filename}`, request.url);
      try {
        const assetResp = await env.ASSETS.fetch(new Request(assetUrl, request));
        if (assetResp && assetResp.status === 200) {
          return assetResp;
        }
      } catch (_) {}
    }

    // Forward API and actuator requests to Render Storefront Backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const isCmsOrNav = url.pathname.startsWith('/api/cms/') || url.pathname.startsWith('/api/navigation');
      const primaryOrigin = isCmsOrNav ? 'https://hearth-admin-backend.onrender.com' : 'https://hearth-backend-0bbo.onrender.com';
      const fallbackOrigin = isCmsOrNav ? 'https://hearth-backend-0bbo.onrender.com' : 'https://hearth-admin-backend.onrender.com';

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
              message: 'The storefront backend is waking up or deploying on Render. Please refresh in a moment.',
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
            message: 'The storefront backend is waking up from cold start on Render. Please refresh in a moment.',
            error: 'Backend temporarily unreachable',
            details: fallbackErr.message 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  },

  // Keep-alive cron trigger to prevent Render backends from sleeping
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.allSettled([
        fetch('https://hearth-backend-0bbo.onrender.com/actuator/health'),
        fetch('https://hearth-admin-backend.onrender.com/actuator/health')
      ]).then(results => {
        console.log('Keep-alive pings sent to Render. Results:', results.map(r => r.status));
      }).catch(err => console.error('Keep-alive ping error:', err))
    );
  }
};
