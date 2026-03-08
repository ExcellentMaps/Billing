// cmd-whoami.js
const { getToken, apiRequest, clr, isLoggedIn } = require('./config');

module.exports = function(program) {
  program
    .command('whoami')
    .description('Show current logged-in user')
    .action(async () => {
      if (!isLoggedIn()) {
        console.log(clr('red', '\n  Not logged in. Run: bonsai login\n'));
        return;
      }
      try {
        const res = await apiRequest('GET', '/api/auth/me', null, getToken());
        const u = res.data;
        console.log(`\n  ${clr('bold', u.name)} ${clr('dim', `<${u.email}>`)}`);
        console.log(clr('dim', `  Member since: ${new Date(u.createdAt).toLocaleDateString()}\n`));
      } catch {
        console.log(clr('red', '\n  Could not fetch user info.\n'));
      }
    });
};
