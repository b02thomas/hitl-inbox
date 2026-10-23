import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const assets = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/app.js', ['app.js','text/javascript; charset=utf-8']],
  ['/style.css', ['style.css','text/css; charset=utf-8']],
]);
export async function serve(store, port = 47831) {
  const csrf = randomBytes(32).toString('hex');
  let origin;
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (code, data) => { response.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); response.end(JSON.stringify(data)); };
    try {
      if (request.headers.host !== new URL(origin).host) return json(403,{error:'Host nicht erlaubt'});
      if (request.headers.origin && request.headers.origin !== origin) return json(403,{error:'Origin nicht erlaubt'});
      const url = new URL(request.url, origin);
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [file,type] = assets.get(url.pathname);
        response.writeHead(200,{'Content-Type':type});
        return response.end(readFileSync(fileURLToPath(new URL(`../web/${file}`,import.meta.url))));
      }
      if (request.method === 'GET' && url.pathname === '/api/inbox') return json(200,{entries:store.list(),csrf});
      const match = /^\/api\/entries\/([a-f0-9-]{36})(\/decision)?$/.exec(url.pathname);
      if (match && request.method === 'GET' && !match[2]) return json(200,{entry:store.get(match[1]),events:store.events(match[1])});
      if (match?.[2] && request.method === 'POST') {
        if (request.headers.origin !== origin || request.headers['x-hitl-csrf'] !== csrf) return json(403,{error:'Entscheidung nur aus dieser Oberfläche'});
        if (request.headers['content-type'] !== 'application/json') return json(415,{error:'JSON erwartet'});
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > 64000) return json(413,{error:'Eingabe zu groß'});
        }
        return json(200,{entry:store.decide(match[1],JSON.parse(body))});
      }
      return json(404,{error:'Nicht gefunden'});
    } catch (error) { json(400,{error:error.message}); }
  });
  await new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(port,'127.0.0.1',resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {server,origin};
}
