export default async function handler(req, res) {
  const backendUrl = process.env.RAILWAY_BACKEND_URL;

  if (!backendUrl) {
    return res.status(500).json({ error: 'RAILWAY_BACKEND_URL no configurada.' });
  }

  const path = req.url;
  const targetUrl = `${backendUrl}${path}`;

  const headers = { ...req.headers };
  delete headers['host'];
  delete headers['connection'];

  try {
    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    const backendRes = await fetch(targetUrl, fetchOptions);

    // Forwardear headers de respuesta excepto los que Vercel maneja
    backendRes.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(backendRes.status);

    const contentType = backendRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await backendRes.json();
      return res.json(data);
    }

    if (contentType.includes('application/pdf')) {
      const buffer = await backendRes.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }

    const text = await backendRes.text();
    return res.send(text);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({ error: 'Error conectando con el backend.' });
  }
}
