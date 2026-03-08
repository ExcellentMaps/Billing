// cmd-logout.js
const { writeConfig, readConfig, getToken, apiRequest, clr } = require('./config');

module.exports = function(program) {
  program
    .command('logout')
    .description('Log out of your Bonsai account')
    .action(async () => {
      const token = getToken();
      if (token) {
        try { await apiRequest('POST', '/api/auth/logout', {}, token); } catch {}
      }
      const cfg = readConfig();
      delete cfg.token;
      delete cfg.user;
      writeConfig(cfg);
      console.log(clr('yellow', '\n  ✓ Logged out.\n'));
    });
};
