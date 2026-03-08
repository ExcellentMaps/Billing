// cmd-stop.js
const fs = require('fs');
const { PID_FILE, clr } = require('./config');

module.exports = function(program) {
  program
    .command('stop')
    .description('Stop the Bonsai local proxy')
    .action(() => {
      try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
        process.kill(pid, 'SIGINT');
        fs.unlinkSync(PID_FILE);
        console.log(clr('yellow', '\n  ✓ Bonsai proxy stopped.\n'));
      } catch {
        console.log(clr('dim', '\n  No proxy is running.\n'));
      }
    });
};
