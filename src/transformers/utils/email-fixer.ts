export class EmailFixer {
  fix(email: string): string {
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) return email;

    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    return `${localPart}@${this.fixDomain(domain)}`;
  }

  private fixDomain(domain: string): string {
    const lastDotIndex = domain.lastIndexOf('.');
    if (lastDotIndex === -1) return domain;

    const prefix = domain.slice(0, lastDotIndex);
    const tld = domain.slice(lastDotIndex + 1);

    const correctedTld = this.fixTld(tld);
    if (correctedTld !== tld) {
      return `${prefix}.${correctedTld}`;
    }

    return domain;
  }

  private fixTld(tld: string): string {
    let normalized = tld.toLowerCase();

    normalized = normalized.replace(/(.)\1+/g, '$1');

    const corrections: Record<string, string> = {
      conm: 'com',
      cpm: 'com',
      vom: 'com',
      cim: 'com',
      cok: 'com',
      fom: 'com',
      comq: 'com',
      comv: 'com',
      comf: 'com',
      coms: 'com',
      coom: 'com',
      comn: 'com',
      comnn: 'com',
      comcn: 'com',
      xom: 'com',
      cob: 'com',
      comau: 'com.au',
      comc: 'com',
      coma: 'com',
      'com]': 'com',
    };

    if (corrections[normalized]) {
      return corrections[normalized];
    }

    if (normalized === 'comm') return 'com';
    if (normalized === 'con') return 'com';

    return tld;
  }
}

export const emailFixer = new EmailFixer();
