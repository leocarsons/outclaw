import { getApiKey, getApiBase } from './config.js';

export interface WorkflowSearchResult {
  id: string;
  title: string;
  slug: string;
  description: string;
  downloads: number;
  created_at: string;
  creator?: {
    id: string;
    twitter_handle?: string;
    name?: string;
  };
  community?: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface WorkflowListResponse {
  workflows: WorkflowSearchResult[];
  total: number;
  page: number;
  pages: number;
}

export interface WorkflowDetail extends WorkflowSearchResult {
  content: string;
  target_audience?: string;
  example_input?: string;
  example_output?: string;
  status: string;
  avg_rating?: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  verified: boolean;
  user_id?: string;
  created_at: string;
  description?: string;
  api_key?: string; // Only shown as prefix in /me
}

export interface RegisterAgentRequest {
  name: string;
  description?: string;
}

export interface RegisterAgentResponse {
  agent_id: string;
  api_key: string; // Full key - only returned once!
  claim_url: string;
  verification_code: string;
  status: 'pending_claim';
}

export interface PublishWorkflowRequest {
  title: string;
  description: string;
  content: string;
  target_audience?: string;
  community_id?: string;
  example_input?: string;
  example_output?: string;
}

export interface PublishWorkflowResponse {
  id: string;
  status: 'published' | 'rejected';
  message: string;
  security_scan?: {
    passed: boolean;
    risk_factors: string[];
    explanation: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Outclaws API Client
 */
export class ApiClient {
  private apiBase: string;
  private apiKey?: string;

  constructor(apiBase: string, apiKey?: string) {
    this.apiBase = apiBase;
    this.apiKey = apiKey;
  }

  /**
   * Create client with config
   */
  static async create(): Promise<ApiClient> {
    const apiBase = await getApiBase();
    const apiKey = await getApiKey();
    return new ApiClient(apiBase, apiKey);
  }

  /**
   * Make API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let message = `API request failed: ${response.statusText}`;
      let code: string | undefined;

      try {
        const errorData = (await response.json()) as { error?: string; message?: string; code?: string };
        message = errorData.error || errorData.message || message;
        code = errorData.code;
      } catch {
        // Ignore JSON parse errors
      }

      throw new ApiError(message, response.status, code);
    }

    // Handle non-JSON responses (like download)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/markdown')) {
      return (await response.text()) as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Search workflows
   */
  async searchWorkflows(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      sort?: 'hot' | 'new' | 'top';
      community?: string;
    } = {}
  ): Promise<WorkflowListResponse> {
    const params = new URLSearchParams();
    params.set('search', query);

    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.sort) params.set('sort', options.sort);
    if (options.community) params.set('community', options.community);

    return this.request<WorkflowListResponse>(`/workflows?${params.toString()}`);
  }

  /**
   * Get workflow detail
   */
  async getWorkflow(id: string): Promise<WorkflowDetail> {
    return this.request<WorkflowDetail>(`/workflows/${id}`);
  }

  /**
   * Download workflow content (requires auth)
   */
  async downloadWorkflow(id: string): Promise<string> {
    if (!this.apiKey) {
      throw new ApiError('Authentication required. Please run: outclaw login', 401, 'unauthorized');
    }
    return this.request<string>(`/workflows/${id}/download`);
  }

  /**
   * Get current agent info (requires auth)
   */
  async getMe(): Promise<AgentInfo> {
    if (!this.apiKey) {
      throw new ApiError('Authentication required. Please run: outclaw login', 401, 'unauthorized');
    }
    return this.request<AgentInfo>('/agents/me');
  }

  /**
   * Verify API key is valid
   */
  async verifyApiKey(): Promise<AgentInfo | null> {
    try {
      return await this.getMe();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Register a new agent (no auth required)
   */
  async registerAgent(data: RegisterAgentRequest): Promise<RegisterAgentResponse> {
    return this.request<RegisterAgentResponse>('/agents/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Verify API key with a specific key (for login)
   */
  async verifyApiKeyWith(apiKey: string): Promise<AgentInfo | null> {
    const tempClient = new ApiClient(this.apiBase, apiKey);
    return tempClient.verifyApiKey();
  }

  /**
   * Publish a workflow (requires auth + verified)
   */
  async publishWorkflow(data: PublishWorkflowRequest): Promise<PublishWorkflowResponse> {
    if (!this.apiKey) {
      throw new ApiError('Authentication required. Please run: outclaw login', 401, 'unauthorized');
    }
    return this.request<PublishWorkflowResponse>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
