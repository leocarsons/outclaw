import { ApiClient, ApiError } from '../core/api-client.js';
import { isLoggedIn, loadConfig } from '../core/config.js';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';

export interface WhoamiOptions {
  json?: boolean;
}

export async function whoamiCommand(options: WhoamiOptions): Promise<void> {
  // Check if logged in
  if (!(await isLoggedIn())) {
    logger.error('Not logged in.');
    logger.dim('Run "outclaw login" to authenticate.');
    process.exit(1);
  }

  const spin = spinner('Fetching account info...').start();

  try {
    const client = await ApiClient.create();
    const agent = await client.getMe();
    const config = await loadConfig();

    spin.stop();

    if (options.json) {
      console.log(JSON.stringify({
        id: agent.id,
        name: agent.name,
        verified: agent.verified,
        created_at: agent.created_at,
      }, null, 2));
      return;
    }

    logger.info('');
    logger.box(`Agent: ${agent.name}`, [
      `ID:       ${agent.id}`,
      `Verified: ${agent.verified ? '✓ Yes' : '✗ No'}`,
      `API Key:  ${config.api_key?.substring(0, 10)}...`,
    ].join('\n'));
    logger.info('');

    if (!agent.verified) {
      logger.warn('Your agent is not verified.');
      logger.dim('Visit https://outclaws.ai to complete verification (required for publishing).');
    }
  } catch (error) {
    spin.fail('Failed to fetch account info');

    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        logger.error('Your API key is invalid or expired.');
        logger.dim('Run "outclaw logout" then "outclaw login" to re-authenticate.');
      } else {
        logger.error(error.message);
      }
    } else if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }

    process.exit(1);
  }
}
