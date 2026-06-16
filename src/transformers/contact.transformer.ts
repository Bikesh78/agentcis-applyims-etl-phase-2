import { FieldMapper } from './utils/field-mappers.js';
import { IdResolver } from './utils/id-resolver.js';
import { BaseTransformer } from './base.transformer.js';
import { AgentcisFirstPointOfContact, Clients } from '../entities/agentcis/clients.entity.js';
import { ApplyIMSContact } from '../entities/applyims/contact.entity.js';
import { isUuid } from './utils/validators.js';
import { COUNTRIES_MAPS } from 'constants/country-map.js';
import { logger } from '../utils/logger.js';

export class ContactTransformer extends BaseTransformer<Clients, ApplyIMSContact> {
  constructor(
    idResolver: IdResolver,
    private fieldMapper: FieldMapper
  ) {
    super(idResolver);
  }

  protected async transformImpl(source: Clients, id: string): Promise<ApplyIMSContact | null> {
    // console.log('source', source)
    const existingContactId = await this.idResolver.checkContactId(source.id);
    if (existingContactId) {
      return null;
    }

    const dialCode = this.fieldMapper.getDialCode(source.phoneNumberCountryCode);

    const branchId = await this.idResolver.resolveBranchId(source.branchId);
    const assigneeId = await this.idResolver.resolveUserId(source.assignedTo);
    const archivedBy = await this.idResolver.resolveUserId(source.archivedBy);
    const createdBy = await this.idResolver.resolveUserId(source.userId);

    if (!branchId) {
      throw new Error(`Cannot resolve BranchId ${source.branchId}`);
    }

    const email = this.fieldMapper.cleanEmail(source.email);
    if (!email) {
      logger.warn('Skipping contact with no email', {
        entityType: 'contacts',
        sourceId: source.id,
      });
      return null;
    }

    let firstName = this.fieldMapper.cleanName(source.firstName);
    let lastName = this.fieldMapper.cleanName(source.lastName);

    if (!firstName && lastName) firstName = '.';
    if (!lastName && firstName) lastName = '.';

    if (!firstName && !lastName) {
      throw new Error('Both FirstName and LastName are required');
    }

    const followerIds = [...new Set(source.followers?.map((f) => f.userId) ?? [])];
    const resolvedFollowers = await this.idResolver.resolveUserIds(followerIds);
    const followers = [
      ...new Map(resolvedFollowers.map((userId) => [userId, { id: userId }])).values(),
    ];

    return {
      id,
      agentcisClientId: `EEVS-` + source.id,
      agentcisInternalId: source.id,
      firstName: firstName!,
      lastName: lastName!,
      email,
      createdBy: createdBy!,
      phone: this.fieldMapper.cleanPhone(source.phone, dialCode),
      countryCode: dialCode ? `+${dialCode}` : undefined,
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
      countryOfPassport: source.countryOfPassport
        ? (COUNTRIES_MAPS[Number(source.countryOfPassport)] ?? source.countryOfPassport)
        : null,
      followers,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      street: source.street,
      city: source.city,
      state: source.state,
      zipCode: source.zipCode,
      preferredIntake: source.preferredIntake,
      visaExpiryDate: source.visaExpiryDate,
      visaType: source.visaType,
    };
  }

  protected validate(target: ApplyIMSContact): void {
    if (!target.email) {
      throw new Error(`Invalid email: ${target.email}`);
    }
    if (/[\[\]<>(){}\\,;:]/.test(target.email)) {
      throw new Error(`Invalid email characters: ${target.email}`);
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
