#!/usr/bin/env node
/**
 * Hemmers CLI Entry Point
 * Universal AI Agent Enhancement Platform
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { agentsCommand } from './commands/agents.js';
import { doctorCommand } from './commands/doctor.js';
import { searchCommand } from './commands/search.js';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { profileCommand } from './commands/profile.js';

const program = new Command();

program
  .name('hemmers')
  .description('Universal AI Agent Enhancement Platform & Secure Runtime')
  .version('0.1.0');

// Global JSON flag
program.option('--json', 'Output results in machine-readable JSON format');

// Commands
program
  .command('init')
  .description('Initialize Hemmers environment and detect installed agents')
  .action(async () => {
    try {
      await initCommand();
    } catch (err) {
      console.error('Initialization failed:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('agents')
  .description('List detected agents and capability scores')
  .option('--json', 'Output results as JSON')
  .action(async (cmdOptions) => {
    try {
      await agentsCommand();
    } catch (err) {
      console.error('Agent detection failed:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check Hemmers health, security policies, and diagnose issues')
  .option('--json', 'Output report in JSON format')
  .action(async (cmdOptions) => {
    try {
      const opts = { json: cmdOptions.json || program.opts().json };
      await doctorCommand(opts);
    } catch (err) {
      console.error('Doctor diagnostics failed:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('add <package>')
  .description('Install a skill, tool, or profile')
  .action(async (pkg) => {
    try {
      await addCommand(pkg);
    } catch (err) {
      console.error(`Failed to add package "${pkg}":`, (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('remove <package>')
  .description('Remove an installed skill, tool, or profile')
  .option('--json', 'Output result as JSON')
  .action(async (pkg, cmdOptions) => {
    try {
      const opts = { json: cmdOptions.json || program.opts().json };
      await removeCommand(pkg, opts);
    } catch (err) {
      console.error(`Failed to remove "${pkg}":`, (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List installed skills, tools, and profiles')
  .action(async () => {
    try {
      await listCommand();
    } catch (err) {
      console.error('Listing failed:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search for skills, tools, and profiles in registry')
  .action(async (query) => {
    try {
      await searchCommand(query);
    } catch (err) {
      console.error('Search failed:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('profile [name]')
  .description('Activate or inspect an agent profile')
  .option('--list', 'List all available profiles')
  .option('--json', 'Output in JSON format')
  .action(async (name, cmdOptions) => {
    try {
      const opts = {
        list: cmdOptions.list,
        json: cmdOptions.json || program.opts().json
      };
      await profileCommand(name, opts);
    } catch (err) {
      console.error('Profile operation failed:', (err as Error).message);
      process.exit(1);
    }
  });

program.parse();
