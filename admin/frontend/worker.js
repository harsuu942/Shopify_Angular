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

    // Forward API and actuator requests directly to the live Render Backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const targetUrl = new URL(url.pathname + url.search, 'https://hearth-backend-0bbo.onrender.com');
      const headers = new Headers(request.headers);
      headers.set('host', targetUrl.host);
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
      headers.set('x-portal', 'admin');

      // Safely buffer request body for POST/PUT/PATCH to prevent stream-locking errors
      let body = undefined;
      if (!['GET', 'HEAD'].includes(request.method)) {
        try {
          body = await request.arrayBuffer();
        } catch (_) {
          body = undefined;
        }
      }

      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: body,
        redirect: 'follow',
        duplex: 'half'
      });

      try {
        const resp = await fetch(proxyRequest);
        if (resp.status === 404 && targetUrl.pathname === '/api/navigation') {
          // If admin /api/navigation returns 404, fallback to /api/cms/navigation
          const cmsReq = new Request('https://hearth-backend-0bbo.onrender.com/api/cms/navigation', {
            method: 'GET',
            headers: headers
          });
          try {
            const cmsResp = await fetch(cmsReq);
            if (cmsResp.status === 200) return cmsResp;
          } catch (_) {}
        }
        if (resp.status >= 500) {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('text/html')) {
            return new Response(JSON.stringify({
              message: 'The backend service is waking up or deploying on Render. Please try again in a few moments.',
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
          message: 'The backend service is waking up from cold start on Render. Please try again in a few seconds.',
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
  }
};
