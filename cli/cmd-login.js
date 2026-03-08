/**
 * bonsai login — authenticate via browser or API key
 */

const readline = require('readline');
const { apiRequest, writeConfig, readConfig, clr, printLogo, getServerUrl } = require('./config');

module.exports = function(program) {
  program
    .command('login')
    .description('Log in to your Bonsai account')
    .option('--key <apikey>', 'Authenticate directly with an API key')
    .option('--server <url>', 'Custom server URL (default: http://localhost:3000)')
    .action(async (opts) => {
      printLogo();

      // Save custom server URL if provided
      if (opts.server) {
        const cfg = readConfig();
        writeConfig({ ...cfg, serverUrl: opts.server });
        console.log(clr('dim', `  Server set to: ${opts.server}\n`));
      }

      if (opts.key) {
        // Direct API key auth
        await loginWithKey(opts.key);
      } else {
        // Email/password auth
        await loginInteractive();
      }
    });
};

async function loginWithKey(key) {
  console.log(clr('cyan', '  Verifying API key...'));
  // Verify key works by hitting proxy
  try {
    const res = await apiRequest('GET', '/api/auth/me', null, key);
    if (res.status === 200) {
      writeConfig({ ...readConfig(), token: key, user: res.data });
      console.log(clr('brightGreen', `\n  ✓ Authenticated as ${res.data.name} (${res.data.email})`));
      console.log(clr('dim', `\n  Run ${clr('cyan', 'bonsai start')} to begin coding.\n`));
    } else {
      console.error(clr('red', `  ✗ Invalid API key`));
      process.exit(1);
    }
  } catch (e) {
    console.error(clr('red', `  ✗ Could not connect to server: ${e.message}`));
    process.exit(1);
  }
}

async function loginInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log(clr('cyan', '  Enter your Bonsai credentials\n'));
  console.log(clr('dim', `  Server: ${getServerUrl()}\n`));

  const email = await ask(clr('bold', '  Email: '));
  const password = await askPassword('  Password: ');
  rl.close();
  console.log();

  console.log(clr('dim', '  Authenticating...'));

  try {
    const res = await apiRequest('POST', '/api/auth/login', { email, password });
    if (res.status === 200) {
      const { token, user } = res.data;
      writeConfig({ ...readConfig(), token, user });
      console.log(clr('brightGreen', `\n  ✓ Welcome back, ${user.name}!`));
      console.log(clr('dim', `\n  Run ${clr('cyan', 'bonsai start')} to begin coding.\n`));
    } else {
      console.error(clr('red', `\n  ✗ ${res.data.error || 'Login failed'}`));
      process.exit(1);
    }
  } catch (e) {
    console.error(clr('red', `\n  ✗ Could not connect: ${e.message}`));
    console.error(clr('dim', `    Make sure the Bonsai server is running at ${getServerUrl()}`));
    process.exit(1);
  }
}

function askPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);

    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', function handler(char) {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    });
  });
}
