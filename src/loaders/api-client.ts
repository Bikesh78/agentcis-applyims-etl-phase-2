import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logger } from '../utils/logger.js';
import { ApiConfig } from '../configs/api.config.js';
import { ApplyIMSContact } from 'entities/applyims/contact.entity.js';
import { ApplyIMSApplication } from 'entities/applyims/application.entity.js';
import { ApplyIMSDeal } from 'entities/applyims/deal.entity.js';
import { ApplyIMSOfficeVisit } from 'entities/applyims/office-visit.entity.js';
import { ApplyIMSMedia } from 'entities/applyims/media.entity.js';
import { ApplyIMSAgentPartner } from 'entities/applyims/agent.entity.js';
import { ApplyIMSContactActivity } from 'entities/applyims/contact-activity.entity.js';
import { ApplyIMSUser } from 'entities/applyims/user.entity.js';
import { ApplyIMSNote } from 'entities/applyims/note.entity.js';

export interface ExistingContactInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  countryCode?: string;
  assigneeId?: string;
  branchId?: string;
  secondaryBranches?: { id: string }[];
  createdBy?: { id: string };
  internalId?: string;
  source?: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  country?: string;
  state?: string;
  city?: string;
  countryOfPassport?: string;
}

export interface CreateContactResponse {
  id: string;
  [key: string]: unknown;
}

export interface BulkResponse {
  successful: Array<{ id: string; internalId: string; appIdentifier?: string }>;
  failed: Array<{
    code: number | string;
    error: string;
    internalId: string;
    existingContact?: ExistingContactInfo;
    payload?: Record<string, any>;
  }>;
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
  private logger: Logger;
  private config: ApiConfig;
  private authRetryCount = 0;

  constructor(config: ApiConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    this.axiosInstance = axios.create({
      baseURL: config.url,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Origin: config.origin,
        'x-tenant-id': this.config.tenantId,
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
          'x-tenant-id': this.config.tenantId,
        },
      }
    );

    this.authToken = response.data.data.access_token;
    this.authRetryCount = 0;

    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    this.logger.info('Authenticated with ApplyIMS API, token set');
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        await this.rateLimiter.consume(1);
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
        console.log(
          'error status:',
          error.response?.status,
          '\nerror body:',
          JSON.stringify(error.response?.data, null, 2)
        );
        const maxRetries = this.config.maxAuthRetries ?? 3;
        if (error.response?.status === 401) {
          if (this.authRetryCount >= maxRetries) {
            this.logger.error(`Max auth retry limit (${maxRetries}) reached. Stopping migration.`);
            throw new Error(
              `Authentication failed after ${maxRetries} retries. Please check credentials.`
            );
          }
          this.authRetryCount++;
          this.logger.info(
            `Received 401, re-authenticating... (attempt ${this.authRetryCount}/${maxRetries})`
          );
          await this.authenticate();
          if (error.config) {
            return this.axiosInstance.request(error.config);
          }
        }
        throw error;
      }
    );
  }

  async createContact(payload: CreateContactRequest): Promise<CreateContactResponse> {
    const response = await this.axiosInstance.post('/v1/contacts', payload);
    return response.data.data;
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

  async bulkCreateOfficeVisits(officeVisits: ApplyIMSOfficeVisit[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/office-visits/bulk', { officeVisits });
    return response.data.data;
  }

  async bulkCreateMedia(medias: ApplyIMSMedia[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/media/bulk', { medias });
    return response.data.data;
  }

  async bulkCreateAgents(agentPartners: ApplyIMSAgentPartner[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/agent-partners/bulk', { agentPartners });
    return response.data.data;
  }

  async bulkCreateUsers(users: ApplyIMSUser[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/users/bulk', { users });
    return response.data.data;
  }

  async bulkCreateNotes(notes: ApplyIMSNote[]): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/notes/bulk', { notes });
    return response.data.data;
  }

  async bulkCreateContactActivities(
    contactActivities: ApplyIMSContactActivity[]
  ): Promise<BulkResponse> {
    const response = await this.axiosInstance.post('/v1/contact-activities/bulk', {
      activities: contactActivities,
    });
    return response.data.data;
  }
}
