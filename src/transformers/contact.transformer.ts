import { FieldMapper } from './utils/field-mappers.js';
import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { AgentcisFirstPointOfContact, Clients } from '../entities/agentcis/clients.entity.js';
import { ApplyIMSContact } from '../entities/applyims/contact.entity.js';
import { isUuid } from './utils/validators.js';
import { COUNTRIES_MAPS } from 'constants/country-map.js';

export class ContactTransformer extends BaseTransformer<Clients, ApplyIMSContact> {
  constructor(
    idResolver: IdResolver,
    private fieldMapper: FieldMapper
  ) {
    super(idResolver);
  }

  protected async transformImpl(source: Clients, id: string): Promise<ApplyIMSContact> {
    const branchId = await this.idResolver.resolveBranchId(source.branchId);
    const assigneeId = await this.idResolver.resolveUserId(source.assignedTo);
    const archivedBy = await this.idResolver.resolveUserId(source.archivedBy);
    const createdBy = await this.idResolver.resolveUserId(source.userId);

    if (!branchId) {
      throw new Error(`Cannot resolve BranchId ${source.branchId}`);
    }

    let firstName = this.fieldMapper.cleanName(source.firstName);
    let lastName = this.fieldMapper.cleanName(source.lastName);

    if (!firstName && lastName) firstName = '.';
    if (!lastName && firstName) lastName = '.';

    if (!firstName && !lastName) {
      throw new Error('Both FirstName and LastName are required');
    }

    return {
      ...source,
      id,
      agentcisClientId: `EEVS-` + source.id,
      agentcisInternalId: source.id,
      firstName: firstName!,
      lastName: lastName!,
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
      country: source.country ? COUNTRIES_MAPS[source.country] : null,
    };
  }

  protected validate(target: ApplyIMSContact): void {
    if (!target.email) {
      throw new Error(`Invalid email: ${target.email}`);
    }
    if (!isUuid(target.id)) {
      throw new Error(`Invalid UUID: ${target.id}`);
    }
  }

  private mapSource(source: AgentcisFirstPointOfContact | null): string | null {
    if (source === 'In Person') return 'Office-Visit';
    return source;
  }
}
