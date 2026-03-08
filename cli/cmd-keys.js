// cmd-keys.js
const { getToken, apiRequest, clr, isLoggedIn } = require('./config');

module.exports = function(program) {
  const keys = program.command('keys').description('Manage API keys');

  keys
    .command('list')
    .description('List your API keys')
    .action(async () => {
      if (!isLoggedIn()) { console.log(clr('red', '\n  Not logged in.\n')); return; }
      const res = await apiRequest('GET', '/api/keys', null, getToken());
      const list = res.data;
      console.log(clr('bold', `\n  API Keys (${list.length})\n`));
      if (!list.length) {
        console.log(clr('dim', '  No keys yet. Create one in the dashboard.\n'));
        return;
      }
      list.forEach(k => {
        const status = k.active ? clr('brightGreen', '● active') : clr('red', '✕ revoked');
        console.log(`  ${clr('bold', k.name)}`);
        console.log(`    ${clr('dim', k.key)}  ${status}`);
        console.log(`    ${clr('dim', `Created: ${new Date(k.createdAt).toLocaleDateString()} · ${k.requests} requests`)}\n`);
      });
    });

  keys
    .command('create <name>')
    .description('Create a new API key')
    .action(async (name) => {
      if (!isLoggedIn()) { console.log(clr('red', '\n  Not logged in.\n')); return; }
      const res = await apiRequest('POST', '/api/keys', { name }, getToken());
      const k = res.data;
      console.log(clr('brightGreen', `\n  ✓ Key created: ${clr('bold', k.name)}`));
      console.log(clr('yellow', `\n  ${k.key}`));
      console.log(clr('dim', '\n  ⚠ Save this key now — it won\'t be shown again.\n'));
    });
};
