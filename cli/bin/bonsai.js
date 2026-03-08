#!/usr/bin/env node
/**
 * Billing CLI — @your-name/bonsai-cli
 * Commands: login, logout, start, stop, status, whoami, keys
 */

const { Command } = require('commander');
const program = new Command();

const pkg = require('../package.json');

program
  .name('billing')
  .description('🌱 Billing — Free frontier coding models')
  .version(pkg.version);

// Import commands
require('../lib/cmd-login')(program);
require('../lib/cmd-logout')(program);
require('../lib/cmd-start')(program);
require('../lib/cmd-stop')(program);
require('../lib/cmd-status')(program);
require('../lib/cmd-whoami')(program);
require('../lib/cmd-keys')(program);

program.parse(process.argv);
