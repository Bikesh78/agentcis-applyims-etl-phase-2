import { FieldMapper } from './utils/field-mappers.js';
import { IdResolver } from './utils/id-resolver.js';
import { AgentcisFirstPointOfContact, Clients } from 'entities/agentcis/clients.entity.js';
import { ApplyIMSContact } from 'entities/applyims/contact.entity.js';
import { isEmail, isUuid } from './utils/validators.js';
import { Logger } from 'utils/logger.js';

export class ContactTransformer {
  constructor(
    private idResolver: IdResolver,
    private fieldMapper: FieldMapper,
    private logger: Logger
  ) {}

  async transform(source: Clients): Promise<ApplyIMSContact> {
    const id = crypto.randomUUID();
    const branchId = await this.idResolver.resolveBranchId(source.branchId);
    const assigneeId = await this.idResolver.resolveUserId(source.assignedTo);
    const archivedBy = await this.idResolver.resolveUserId(source.archivedBy);
    const createdBy = await this.idResolver.resolveUserId(source.userId);

    if (!branchId) {
      throw new Error(`Cannot resolve BranchId ${source.branchId}`);
    }

    const transformed: ApplyIMSContact = {
      ...source,
      id: id,
      agentcisClientId: `EEVS-` + source.id,
      agentcisInternalId: source.id,
      firstName: this.fieldMapper.cleanName(source.firstName)!,
      lastName: this.fieldMapper.cleanName(source.lastName)!,
      email: this.fieldMapper.cleanEmail(source.email)!,
      createdBy: createdBy!,
      phone: this.fieldMapper.cleanPhone(source.phone, source.phoneNumberCountryCode),
      dateOfBirth: this.fieldMapper.formatDate(source.dob),
      source: this.mapSource(source.firstPointOfContact),
      postalCode: null,
      assigneeId,
      archived: Boolean(source.archivedBy),
      archivedBy,
      passportNo: source.passportNumber,
      branchId: branchId,
      gender: null,
      nationality: null,
      country: null,
    };

    this.validate(transformed);
    return transformed;
  }

  private mapSource(source: AgentcisFirstPointOfContact | null): string | null {
    if (source === 'In Person') return 'Office-Visit';
    return source;
  }

  private validate(contact: ApplyIMSContact): void {
    if (!contact.firstName || !contact.lastName) {
      throw new Error('FirstName and LastName are required');
    }
    if (!isEmail(contact.email)) {
      throw new Error(`Invalid email: ${contact.email}`);
    }
    if (!isUuid(contact.id)) {
      throw new Error(`Invalid UUID: ${contact.id}`);
    }
  }
}
