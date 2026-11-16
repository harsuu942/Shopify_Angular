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
          const res = new Response(assetResp.body, assetResp);
          res.headers.set('Access-Control-Allow-Origin', '*');
          return res;
        }
      } catch (_) {}

      // If not in static assets, proxy to Render Admin Backend (dynamic uploads) or Storefront Backend
      try {
        const adminImgUrl = `https://hearth-admin-backend.onrender.com/api/product-images/${filename}`;
        const resp = await fetch(adminImgUrl, { method: 'GET', headers: { 'Accept': 'image/*' } });
        if (resp && resp.status === 200) {
          const res = new Response(resp.body, resp);
          res.headers.set('Access-Control-Allow-Origin', '*');
          res.headers.set('Cache-Control', 'public, max-age=31536000');
          return res;
        }
      } catch (_) {}

      try {
        const shopImgUrl = `https://hearth-backend-0bbo.onrender.com/api/product-images/${filename}`;
        const resp2 = await fetch(shopImgUrl, { method: 'GET', headers: { 'Accept': 'image/*' } });
        if (resp2 && resp2.status === 200) {
          const res2 = new Response(resp2.body, resp2);
          res2.headers.set('Access-Control-Allow-Origin', '*');
          res2.headers.set('Cache-Control', 'public, max-age=31536000');
          return res2;
        }
      } catch (_) {}
    }

    // Forward API and actuator requests to Render Backends
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const isNavRequest = url.pathname === '/api/cms/navigation' || url.pathname === '/api/navigation';
      const isBannerRequest = url.pathname === '/api/cms/banners' || url.pathname === '/api/banners';
      const isCampaignRequest = url.pathname === '/api/cms/campaigns';

      let targetOrigin = 'https://hearth-backend-0bbo.onrender.com';
      let targetPath = url.pathname + url.search;

      if (isNavRequest) {
        targetOrigin = 'https://hearth-admin-backend.onrender.com';
        targetPath = '/api/internal/navigation';
      } else if (isBannerRequest) {
        targetOrigin = 'https://hearth-admin-backend.onrender.com';
        targetPath = '/api/internal/banners';
      } else if (isCampaignRequest) {
        targetOrigin = 'https://hearth-admin-backend.onrender.com';
        targetPath = '/api/internal/campaigns';
      }

      let body = undefined;
      if (!['GET', 'HEAD'].includes(request.method)) {
        try {
          body = await request.arrayBuffer();
        } catch (_) {
          body = undefined;
        }
      }

      const forwardRequest = async (origin, path) => {
        const targetUrl = new URL(path, origin);
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
        let resp = await forwardRequest(targetOrigin, targetPath);
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
        return new Response(JSON.stringify({ 
          message: 'The storefront backend is waking up from cold start on Render. Please refresh in a moment.',
          error: 'Backend temporarily unreachable',
          details: err.message 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
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
