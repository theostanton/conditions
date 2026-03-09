/**
 * Cloudflare Worker to serve landing page from Google Cloud Storage
 *
 * Uses the Cache API with a zone-based cache key so that
 * Cloudflare zone purges (purge_everything) actually invalidate the
 * cached GCS response. The previous approach used cf.cacheTtl on the
 * GCS subrequest, which keyed the cache on the GCS URL — outside the
 * zone, so purges never reached it.
 */

const GCS_BASE = 'https://storage.googleapis.com/conditions-450312-bras/landing';
const CACHE_KEY_BASE = 'https://conditionsreport.com/__landing';
// Injected by Terraform templatefile() — avoid dollar-brace syntax elsewhere in this file
const REPORT_FUNCTION_URL = '${report_function_url}';

async function handleRequest(request) {
  const url = new URL(request.url);

  // Redirect conditionsreports.com (plural) to conditionsreport.com (singular)
  if (url.hostname === 'conditionsreports.com' || url.hostname === 'www.conditionsreports.com') {
    return Response.redirect('https://conditionsreport.com/', 301);
  }

  // Redirect www to root domain
  if (url.hostname === 'www.conditionsreport.com') {
    return Response.redirect('https://conditionsreport.com/', 301);
  }

  // Check for slug-like paths (no extension, single segment) → proxy to report function
  const segment = url.pathname.replace(/^\/|\/$/g, '');
  if (segment && !segment.includes('/') && !segment.includes('.')) {
    const cache = caches.default;
    const reportCacheKey = new Request(CACHE_KEY_BASE + '/__report/' + segment);

    // Check cache first
    const cachedReport = await cache.match(reportCacheKey);
    if (cachedReport) return cachedReport;

    try {
      // redirect: 'manual' prevents the Worker from following 302s back into the same zone
      const reportResp = await fetch(REPORT_FUNCTION_URL + '/' + segment, { redirect: 'manual' });

      // Pass redirects (unknown slugs) through to the client
      if (reportResp.status >= 300 && reportResp.status < 400) {
        return Response.redirect('https://conditionsreport.com/', 302);
      }

      const response = new Response(reportResp.body, reportResp);

      // Only cache successful report pages (not loading pages)
      const cacheControl = response.headers.get('Cache-Control') || '';
      if (reportResp.ok && cacheControl.includes('max-age')) {
        await cache.put(reportCacheKey, response.clone());
      }

      return response;
    } catch (error) {
      // Fall through to GCS on error
    }
  }

  // Map request path to GCS object
  const path = url.pathname === '/' || url.pathname === '' ? '/index.html' : url.pathname;
  const gcsUrl = GCS_BASE + path;
  const cacheKey = new Request(CACHE_KEY_BASE + path);

  try {
    const cache = caches.default;

    // Check zone-scoped cache first
    let cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Fetch from GCS (no cf caching — we manage the cache ourselves)
    const origin = await fetch(gcsUrl);

    if (!origin.ok) {
      // If not the root page, redirect to root instead of showing an error
      if (path !== '/index.html') {
        return Response.redirect('https://conditionsreport.com/', 302);
      }
      return new Response('Error loading page', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const response = new Response(origin.body, origin);
    response.headers.set('Cache-Control', 'public, max-age=3600');
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Store under zone-scoped key so zone purges clear it
    await cache.put(cacheKey, response.clone());

    return response;
  } catch (error) {
    return new Response('Error loading page: ' + error.message, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
