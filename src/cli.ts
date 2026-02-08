import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { installCommand } from './commands/install.js';
import { uninstallCommand } from './commands/uninstall.js';
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { publishCommand } from './commands/publish.js';
import { forkCommand } from './commands/fork.js';

const VERSION = '0.2.6';

export const cli = new Command();

cli
  .name('outclaw')
  .description('CLI tool for managing Claude Code Skills')
  .version(VERSION);

// login command
cli
  .command('login')
  .description('Authenticate with Outclaws')
  .option('-t, --token <key>', 'API key for authentication')
  .action(async (options) => {
    await loginCommand(options);
  });

// logout command
cli
  .command('logout')
  .description('Log out and remove stored credentials')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    await logoutCommand(options);
  });

// whoami command
cli
  .command('whoami')
  .description('Show current authenticated agent')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await whoamiCommand(options);
  });

// init command
cli
  .command('init [name]')
  .description('Create a new skill project')
  .option('-g, --global', 'Create in global skills directory (~/.claude/skills)')
  .option('-t, --template <type>', 'Skill template (minimal, standard, complete)', 'minimal')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (name, options) => {
    await initCommand({ name, ...options });
  });

// install command
cli
  .command('install <skill>')
  .alias('i')
  .alias('add')
  .description('Install a skill from registry, GitHub, or URL')
  .option('-g, --global', 'Install globally (~/.claude/skills)')
  .option('-f, --force', 'Overwrite existing skill')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (skill, options) => {
    await installCommand(skill, options);
  });

// uninstall command
cli
  .command('uninstall <skill>')
  .alias('rm')
  .alias('remove')
  .description('Uninstall a skill')
  .option('-g, --global', 'Uninstall from global directory')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (skill, options) => {
    await uninstallCommand(skill, options);
  });

// list command
cli
  .command('list')
  .alias('ls')
  .description('List installed skills')
  .option('-g, --global', 'List only global skills')
  .option('-p, --project', 'List only project skills')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await listCommand(options);
  });

// search command
cli
  .command('search <query>')
  .alias('find')
  .description('Search for skills in the registry')
  .option('-l, --limit <number>', 'Maximum results', '20')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    await searchCommand(query, { ...options, limit: parseInt(options.limit) });
  });

// info command
cli
  .command('info <skill>')
  .description('Show detailed information about a skill')
  .option('-g, --global', 'Look in global skills')
  .action(async (skill, options) => {
    await infoCommand(skill, options);
  });

// publish command
cli
  .command('publish <path>')
  .description('Publish a skill to Outclaws registry')
  .option('-t, --title <title>', 'Skill title')
  .option('-d, --description <desc>', 'Skill description')
  .option('-c, --community <id>', 'Community ID')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (path, options) => {
    await publishCommand(path, options);
  });

// fork command - import skills from ClawHub
cli
  .command('fork <slug>')
  .description('Fork a skill from ClawHub and publish to Outclaws')
  .option('-v, --version <version>', 'Specific version to fork')
  .option('-t, --title <title>', 'Override skill title')
  .option('-d, --description <desc>', 'Override skill description')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (slug, options) => {
    await forkCommand(slug, options);
  });

// Handle unknown commands
cli.on('command:*', () => {
  console.error(`Unknown command: ${cli.args.join(' ')}`);
  console.log('Run "outclaw --help" for available commands.');
  process.exit(1);
});
