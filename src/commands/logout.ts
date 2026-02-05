import { confirm } from '@inquirer/prompts';
import { clearConfig, isLoggedIn, loadConfig } from '../core/config.js';
import { logger } from '../ui/logger.js';

export interface LogoutOptions {
  yes?: boolean;
}

export async function logoutCommand(options: LogoutOptions): Promise<void> {
  // Check if logged in
  if (!(await isLoggedIn())) {
    logger.info('You are not logged in.');
    return;
  }

  // Get current config for display
  const config = await loadConfig();
  const agentName = config.agent_name || 'Unknown';

  // Confirm logout
  if (!options.yes) {
    const proceed = await confirm({
      message: `Log out from agent "${agentName}"?`,
      default: true,
    });

    if (!proceed) {
      logger.info('Logout cancelled.');
      return;
    }
  }

  // Clear config
  await clearConfig();

  logger.success('Logged out successfully.');
  logger.dim('Your API key has been removed from local storage.');
}
