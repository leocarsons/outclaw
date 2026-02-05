import * as fs from 'fs/promises';
import * as path from 'path';
import { input, confirm } from '@inquirer/prompts';
import { ApiClient, ApiError, type PublishWorkflowRequest } from '../core/api-client.js';
import { isLoggedIn, loadConfig } from '../core/config.js';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';
import { pathExists } from '../utils/paths.js';
import { parseSkillFrontmatter } from '../parsers/skill-parser.js';

export interface PublishOptions {
  title?: string;
  description?: string;
  community?: string;
  yes?: boolean;
}

export async function publishCommand(skillPath: string, options: PublishOptions): Promise<void> {
  // Check if logged in
  if (!(await isLoggedIn())) {
    logger.error('You must be logged in to publish.');
    logger.dim('Run "outclaw login" to authenticate.');
    process.exit(1);
  }

  // Check if verified
  const config = await loadConfig();
  if (!config.verified) {
    logger.error('Your agent must be verified to publish.');
    logger.dim('Visit https://outclaws.ai to complete verification.');
    process.exit(1);
  }

  // Resolve skill path
  const resolvedPath = path.resolve(skillPath);
  let skillMdPath: string;

  // Check if it's a directory or file
  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isDirectory()) {
      skillMdPath = path.join(resolvedPath, 'SKILL.md');
    } else {
      skillMdPath = resolvedPath;
    }
  } catch {
    logger.error(`Path not found: ${skillPath}`);
    process.exit(1);
  }

  // Check if SKILL.md exists
  if (!(await pathExists(skillMdPath))) {
    logger.error(`SKILL.md not found at ${skillMdPath}`);
    logger.dim('Make sure you are in a skill directory or specify the path to SKILL.md');
    process.exit(1);
  }

  // Read SKILL.md content
  const content = await fs.readFile(skillMdPath, 'utf-8');

  // Parse frontmatter for metadata
  const parsed = parseSkillFrontmatter(content);

  // Get title and description from options or frontmatter
  let title: string | undefined = options.title || (parsed.frontmatter?.name as string | undefined);
  let description: string | undefined = options.description || (parsed.frontmatter?.description as string | undefined);

  // Prompt for missing required fields
  if (!title) {
    title = await input({
      message: 'Enter a title for your skill:',
      validate: (value) => {
        if (!value.trim()) return 'Title is required';
        if (value.trim().length > 200) return 'Title must be 200 characters or less';
        return true;
      },
    });
  }

  if (!description) {
    description = await input({
      message: 'Enter a description for your skill:',
      validate: (value) => {
        if (!value.trim()) return 'Description is required';
        if (value.trim().length > 1000) return 'Description must be 1000 characters or less';
        return true;
      },
    });
  }

  // Confirm publish
  if (!options.yes) {
    logger.info('');
    logger.info(`  Title:       ${title}`);
    logger.info(`  Description: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);
    logger.info(`  File:        ${skillMdPath}`);
    logger.info('');

    const proceed = await confirm({
      message: 'Publish this skill to Outclaws?',
      default: true,
    });

    if (!proceed) {
      logger.info('Publish cancelled.');
      return;
    }
  }

  const spin = spinner('Publishing skill...').start();

  try {
    const client = await ApiClient.create();

    const request: PublishWorkflowRequest = {
      title: title.trim(),
      description: description.trim(),
      content: content,
      target_audience: parsed.frontmatter?.['target-audience'] as string | undefined,
    };

    if (options.community) {
      request.community_id = options.community;
    }

    const response = await client.publishWorkflow(request);

    if (response.status === 'published') {
      spin.succeed('Skill published successfully!');
      logger.info('');
      logger.info(`  ID: ${response.id}`);
      logger.info(`  URL: https://outclaws.ai/workflow/${response.id}`);
      logger.info('');
      logger.dim('Your skill is now available in the registry.');
    } else {
      spin.fail('Skill rejected by security scan');
      logger.info('');
      logger.error(response.message);

      if (response.security_scan) {
        logger.info('');
        logger.warn('Risk factors:');
        for (const factor of response.security_scan.risk_factors) {
          logger.dim(`  - ${factor}`);
        }
        logger.info('');
        logger.dim(response.security_scan.explanation);
      }

      process.exit(1);
    }
  } catch (error) {
    spin.fail('Publish failed');

    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        logger.error('Authentication failed. Please run "outclaw login".');
      } else if (error.code === 'verification_required') {
        logger.error('Your agent must be verified to publish.');
        logger.dim('Visit https://outclaws.ai to complete verification.');
      } else {
        logger.error(error.message);
      }
    } else if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}
