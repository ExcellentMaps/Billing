/**
 * bonsai start — starts local proxy server that forwards
 * AI tool requests to the Bonsai backend (which routes to real models)
 */

const http = require('http');
const https = require('https');
const net = require('net');
const { getToken, getServerUrl, isLoggedIn, clr, printLogo, PID_FILE, apiRequest } = require('./config');
const fs = require('fs');

const PROXY_PORT = 9099; // Local port that AI tools connect to

module.exports = function(program) {
  program
    .command('start')
    .description('Start the Bonsai local proxy (routes AI requests to frontier models)')
    .option('--port <port>', 'Local proxy port', String(PROXY_PORT))
    .action(async (opts) => {
      printLogo();

      if (!isLoggedIn()) {
        console.error(clr('red', '  ✗ Not logged in. Run: bonsai login\n'));
        process.exit(1);
      }

      // Use session token directly for proxy auth — server accepts both session tokens and API keys
      const token = getToken();
      let apiKey = token;
      try {
        // Verify server is reachable and token is valid
        const res = await apiRequest('GET', '/api/auth/me', null, token);
        if (res.status !== 200) {
          console.error(clr('red', '  ✗ Session expired. Run: bonsai login\n'));
          process.exit(1);
        }
      } catch (e) {
        console.error(clr('red', `  ✗ Could not reach server: ${e.message}\n`));
        process.exit(1);
      }

      const port = parseInt(opts.port);
      const serverUrl = new URL(getServerUrl());
      const codename = randomCodename();

      console.log(clr('brightGreen', `  ✓ Connected — assigned: ${clr('cyan', codename)}`));
      console.log(clr('dim', `  Starting local proxy on port ${port}...\n`));

      // Create local proxy server
      const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          // Forward to Bonsai backend
          const targetPath = req.url === '/v1/messages' ? '/v1/messages' : req.url;

          const bodyBuf = Buffer.from(body);
          const isHttps = serverUrl.protocol === 'https:';
          const lib = isHttps ? https : http;

          const options = {
            hostname: serverUrl.hostname,
            port: serverUrl.port || (isHttps ? 443 : 80),
            path: targetPath,
            method: req.method,
            headers: {
              ...req.headers,
              host: serverUrl.hostname,
              'x-api-key': apiKey,
              'authorization': `Bearer ${apiKey}`,
              'content-length': bodyBuf.length,
            }
          };

          const proxyReq = lib.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          });

          proxyReq.on('error', (e) => {
            console.error(clr('red', `  Proxy error: ${e.message}`));
            res.writeHead(502);
            res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
          });

          proxyReq.write(bodyBuf);
          proxyReq.end();
        });
      });

      server.listen(port, '127.0.0.1', () => {
        // Save PID
        fs.writeFileSync(PID_FILE, String(process.pid));

        console.log(clr('brightGreen', `  🌱 Bonsai proxy running!\n`));
        console.log(`  ${clr('bold', 'Proxy URL:')}     ${clr('cyan', `http://127.0.0.1:${port}`)}`);
        console.log(`  ${clr('bold', 'Model:')}         ${clr('yellow', codename)} (stealth mode)`);
        console.log(`  ${clr('bold', 'API format:')}    Anthropic Messages API\n`);
        console.log(clr('dim', '  ─────────────────────────────────────'));
        console.log(clr('bold', '  Configure your AI tool:\n'));
        console.log(`  ${clr('cyan', 'Claude Code:')}    ANTHROPIC_BASE_URL=http://127.0.0.1:${port}`);
        console.log(`  ${clr('cyan', 'Cursor:')}         Set base URL in settings`);
        console.log(`  ${clr('cyan', 'Cline/RooCode:')} API Base URL → http://127.0.0.1:${port}`);
        console.log(clr('dim', '\n  ─────────────────────────────────────'));
        console.log(clr('dim', '  Press Ctrl+C to stop\n'));
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        server.close(() => {
          try { fs.unlinkSync(PID_FILE); } catch {}
          console.log(clr('yellow', '\n\n  🌿 Bonsai stopped. Happy coding!\n'));
          process.exit(0);
        });
      });
    });
};

const CODENAMES = [
  'cute-koala','angry-giraffe','happy-panda','lazy-fox',
  'swift-eagle','brave-wolf','wise-owl','silly-penguin',
  'grumpy-bear','jolly-dolphin','sneaky-cat','bold-tiger'
];
function randomCodename() { return CODENAMES[Math.floor(Math.random() * CODENAMES.length)]; }
