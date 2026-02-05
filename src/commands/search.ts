import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';
import { renderTable } from '../ui/table.js';
import { ApiClient, ApiError } from '../core/api-client.js';

export interface SearchOptions {
  limit: number;
  json?: boolean;
  sort?: 'hot' | 'new' | 'top';
  community?: string;
}

export async function searchCommand(query: string, options: SearchOptions): Promise<void> {
  const spin = spinner(`Searching for "${query}"...`).start();

  try {
    const client = await ApiClient.create();

    const result = await client.searchWorkflows(query, {
      limit: options.limit,
      sort: options.sort,
      community: options.community,
    });

    spin.stop();

    if (result.workflows.length === 0) {
      logger.info(`No skills found matching "${query}"`);
      logger.info('');
      logger.dim('Try a different search term or browse all skills at https://outclaws.ai');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(result.workflows, null, 2));
      return;
    }

    logger.info(`Found ${result.total} skill(s)${result.total > result.workflows.length ? ` (showing ${result.workflows.length})` : ''}:\n`);

    renderTable({
      headers: ['Name', 'Author', 'Downloads', 'Description'],
      rows: result.workflows.map((w) => {
        const author = w.creator?.twitter_handle
          ? `@${w.creator.twitter_handle}`
          : w.creator?.name || 'unknown';
        const desc = w.description.length > 40 ? w.description.slice(0, 37) + '...' : w.description;
        return [w.title, author, String(w.downloads || 0), desc];
      }),
    });

    logger.info('');
    logger.dim('Install with: outclaw install <name>');

    if (result.pages > 1) {
      logger.info('');
      logger.dim(`Page ${result.page} of ${result.pages}. Use --limit and search again for more results.`);
    }
  } catch (error) {
    spin.fail('Search failed');

    if (error instanceof ApiError) {
      logger.error(error.message);

      if (error.statusCode === 0 || error.message.includes('fetch')) {
        logger.dim('Could not connect to Outclaws API. Check your internet connection.');
      }
    } else if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }

    process.exit(1);
  }
}
