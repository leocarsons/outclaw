import Table from 'cli-table3';
import chalk from 'chalk';

export interface TableOptions {
  headers: string[];
  rows: string[][];
}

export function renderTable(options: TableOptions): void {
  const table = new Table({
    head: options.headers.map((h) => chalk.bold.cyan(h)),
    style: {
      head: [],
      border: [],
    },
  });

  for (const row of options.rows) {
    table.push(row);
  }

  console.log(table.toString());
}
