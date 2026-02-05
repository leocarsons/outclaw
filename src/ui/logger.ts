import chalk from 'chalk';

export const logger = {
  info: (message: string) => {
    console.log(message);
  },

  success: (message: string) => {
    console.log(chalk.green('✓'), message);
  },

  error: (message: string) => {
    console.error(chalk.red('✗'), message);
  },

  warn: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },

  dim: (message: string) => {
    console.log(chalk.dim(message));
  },

  skill: (info: { name: string; description: string; author?: string; downloads?: number; installCmd?: string }) => {
    console.log();
    console.log(chalk.bold.cyan(info.name));
    console.log(chalk.dim(info.description));
    const meta: string[] = [];
    if (info.author) {
      meta.push(`by ${info.author}`);
    }
    if (info.downloads !== undefined) {
      meta.push(`${info.downloads.toLocaleString()} downloads`);
    }
    if (meta.length > 0) {
      console.log(chalk.dim(meta.join(' · ')));
    }
    if (info.installCmd) {
      console.log(chalk.dim(`$ ${info.installCmd}`));
    }
  },

  box: (title: string, content: string) => {
    const lines = content.split('\n');
    const maxLen = Math.max(title.length, ...lines.map((l) => l.length));
    const border = '─'.repeat(maxLen + 2);

    console.log(`┌${border}┐`);
    console.log(`│ ${chalk.bold(title.padEnd(maxLen))} │`);
    console.log(`├${border}┤`);
    for (const line of lines) {
      console.log(`│ ${line.padEnd(maxLen)} │`);
    }
    console.log(`└${border}┘`);
  },
};
