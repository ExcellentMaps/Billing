// cmd-status.js
const fs = require('fs');
const net = require('net');
const { PID_FILE, clr, isLoggedIn, readConfig, getServerUrl } = require('./config');

module.exports = function(program) {
  program
    .command('status')
    .description('Show Bonsai proxy status')
    .action(async () => {
      console.log(clr('bold', '\n  🌱 Bonsai Status\n'));

      // Auth status
      if (isLoggedIn()) {
        const cfg = readConfig();
        const name = cfg.user?.name || 'Unknown';
        const email = cfg.user?.email || '';
        console.log(`  Auth:    ${clr('brightGreen', '✓ Logged in')} as ${name} (${email})`);
      } else {
        console.log(`  Auth:    ${clr('red', '✗ Not logged in')}`);
      }

      // Proxy status
      let proxyRunning = false;
      try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
        process.kill(pid, 0); // Check if process exists
        proxyRunning = true;
        console.log(`  Proxy:   ${clr('brightGreen', '✓ Running')} (PID ${pid})`);
      } catch {
        console.log(`  Proxy:   ${clr('dim', '○ Stopped')}`);
      }

      // Server connectivity
      console.log(`  Server:  ${clr('cyan', getServerUrl())}`);
      console.log();
    });
};
