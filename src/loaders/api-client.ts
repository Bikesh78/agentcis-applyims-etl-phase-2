import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logger } from '../utils/logger.js';
import { ApiConfig } from '../configs/api.config.js';
import { ApplyIMSContact } from 'entities/applyims/contact.entity.js';
import { ApplyIMSApplication } from 'entities/applyims/application.entity.js';
import { ApplyIMSDeal } from 'entities/applyims/deal.entity.js';

export interface BulkResponse {
  successful: Array<{ id: string; internalId: string }>;
  failed: Array<{ code: number; error: string; internalId: string }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export class ApplyIMSApiClient {
  private axiosInstance: AxiosInstance;
  private rateLimiter: RateLimiterMemory;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private logger: Logger;
  private config: ApiConfig;

  constructor(config: ApiConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    this.axiosInstance = axios.create({
      baseURL: config.url,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Origin: config.origin,
      },
    });

    this.rateLimiter = new RateLimiterMemory({
      points: config.rateLimitRps,
      duration: 1,
    });

    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: (retryCount) => {
        const delay = Math.pow(2, retryCount) * 1000;
        return delay;
      },
      retryCondition: (error: AxiosError) => {
        const status = error.response?.status;
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          status === 429 ||
          (status !== undefined && status >= 500)
        );
      },
    });

    this.setupInterceptors();
  }

  async authenticate(): Promise<void> {
    const response = await this.axiosInstance.post(
      '/auth/login',
      {
        email: this.config.email,
        password: this.config.password,
        domain: this.config.domain,
      },
      {
        headers: {
          Origin: this.config.origin,
        },
      }
    );

    this.authToken = response.data.data.access_token;
    this.tokenExpiry = new Date(Date.now() + 3600 * 1000);

    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    this.logger.info('Authenticated with ApplyIMS API, token set');
  }

  private async checkTokenExpiry(): Promise<void> {
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      this.logger.info('Token missing or expired, re-authenticating...');
      await this.authenticate();
    }
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        await this.rateLimiter.consume(1);
        await this.checkTokenExpiry();
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug('API response', {
          url: response.config.url,
          status: response.status,
        });
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.logger.info('Received 401, re-authenticating...');
          await this.authenticate();
          if (error.config) {
            return this.axiosInstance.request(error.config);
          }
        }
        throw error;
      }
    );
  }

  async bulkCreateContacts(contacts: ApplyIMSContact[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/contacts/bulk', { contacts });
    return response.data.data;
  }

  async bulkCreateApplications(applications: ApplyIMSApplication[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/applications/bulk', { applications });
    return response.data.data;
  }

  async bulkCreateDeals(deals: ApplyIMSDeal[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/deals/bulk', { deals });
    return response.data.data;
  }
}
