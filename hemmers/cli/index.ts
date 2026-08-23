#!/usr/bin/env node
/**
 * Hemmers CLI Entry Point
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { agentsCommand } from './commands/agents';
import { searchCommand } from './commands/search';
import { listCommand } from './commands/list';
import { addCommand } from './commands/add';

const program = new Command();

program
  .name('hemmers')
  .description('Universal AI Agent Enhancement Platform')
  .version('0.1.0');

// Commands
program
  .command('init')
  .description('Initialize Hemmers and detect installed agents')
  .action(initCommand);

program
  .command('agents')
  .description('List detected agents and their capabilities')
  .action(agentsCommand);

program
  .command('doctor')
  .description('Check Hemmers health and diagnose issues')
  .action(() => {
    console.log('⚠️  hemmers doctor - Not yet implemented');
  });

program
  .command('add <package>')
  .description('Install a skill, tool, or profile')
  .action(addCommand);

program
  .command('remove <package>')
  .description('Remove a skill, tool, or profile')
  .action((pkg) => {
    console.log(`⚠️  hemmers remove ${pkg} - Not yet implemented`);
  });

program
  .command('list')
  .description('List installed skills, tools, and profiles')
  .action(listCommand);

program
  .command('search <query>')
  .description('Search for skills, tools, and profiles')
  .action(searchCommand);

program
  .command('profile <name>')
  .description('Activate a profile')
  .action((name) => {
    console.log(`⚠️  hemmers profile ${name} - Not yet implemented`);
  });

program.parse();
