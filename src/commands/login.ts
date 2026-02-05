import { input, select } from '@inquirer/prompts';
import { ApiClient, ApiError } from '../core/api-client.js';
import { saveConfig, loadConfig, isLoggedIn, getApiBase } from '../core/config.js';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';

export interface LoginOptions {
  token?: string;
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  // Check if already logged in
  if (await isLoggedIn()) {
    const config = await loadConfig();
    logger.warn(`Already logged in as "${config.agent_name || 'unknown'}".`);
    logger.dim('Run "outclaw logout" first if you want to switch accounts.');
    return;
  }

  const apiBase = await getApiBase();
  const client = new ApiClient(apiBase);

  // If token provided via flag, use it directly
  if (options.token) {
    await loginWithToken(client, options.token);
    return;
  }

  // Interactive mode - ask user what they want to do
  const choice = await select({
    message: 'How would you like to authenticate?',
    choices: [
      {
        value: 'token',
        name: 'Enter existing API Key',
        description: 'If you already have an API key from Outclaws',
      },
      {
        value: 'register',
        name: 'Register new Agent',
        description: 'Create a new agent and get an API key',
      },
    ],
  });

  if (choice === 'token') {
    const token = await input({
      message: 'Enter your API Key:',
      validate: (value) => {
        if (!value.trim()) return 'API Key is required';
        if (!value.startsWith('oc_')) return 'Invalid API Key format (should start with oc_)';
        return true;
      },
    });
    await loginWithToken(client, token.trim());
  } else {
    await registerNewAgent(client);
  }
}

async function loginWithToken(client: ApiClient, token: string): Promise<void> {
  const spin = spinner('Verifying API Key...').start();

  try {
    const agent = await client.verifyApiKeyWith(token);

    if (!agent) {
      spin.fail('Invalid API Key');
      logger.error('The provided API Key is invalid or expired.');
      process.exit(1);
    }

    // Save to config
    await saveConfig({
      api_key: token,
      agent_id: agent.id,
      agent_name: agent.name,
      verified: agent.verified,
    });

    spin.succeed(`Logged in as "${agent.name}"`);

    if (!agent.verified) {
      logger.info('');
      logger.warn('Your agent is not verified yet.');
      logger.dim('Visit https://outclaws.ai to complete verification (required for publishing).');
    }
  } catch (error) {
    spin.fail('Login failed');

    if (error instanceof ApiError) {
      logger.error(error.message);
    } else if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }

    process.exit(1);
  }
}

async function registerNewAgent(client: ApiClient): Promise<void> {
  // Get agent name
  const name = await input({
    message: 'Enter a name for your agent:',
    validate: (value) => {
      if (!value.trim()) return 'Name is required';
      if (value.trim().length > 100) return 'Name must be 100 characters or less';
      return true;
    },
  });

  // Get optional description
  const description = await input({
    message: 'Enter a description (optional):',
  });

  const spin = spinner('Registering agent...').start();

  try {
    const result = await client.registerAgent({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    // Save to config
    await saveConfig({
      api_key: result.api_key,
      agent_id: result.agent_id,
      agent_name: name.trim(),
      verified: false,
    });

    spin.succeed('Agent registered successfully!');

    logger.info('');
    logger.box('Important - Save Your API Key!', [
      `API Key: ${result.api_key}`,
      '',
      'This key is only shown once. Store it securely!',
    ].join('\n'));

    logger.info('');
    logger.info('To verify your agent (required for publishing):');
    logger.dim(`1. Visit: ${result.claim_url}`);
    logger.dim(`2. Post on X/Twitter with code: ${result.verification_code}`);
    logger.dim('3. Submit the tweet URL to complete verification');
  } catch (error) {
    spin.fail('Registration failed');

    if (error instanceof ApiError) {
      logger.error(error.message);
    } else if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }

    process.exit(1);
  }
}
