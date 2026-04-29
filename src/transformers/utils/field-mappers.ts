export class FieldMapper {
  cleanEmail(email: string | null): string | null {
    if (!email) return null;
    return email.trim().toLowerCase();
  }

  cleanPhone(phone: string | null, countryCode: string | null): string | null {
    if (!phone) return null;
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (countryCode && !cleaned.startsWith('+')) {
      return `+${countryCode}${cleaned}`;
    }
    return cleaned;
  }

  cleanName(name: string | null): string | null {
    if (!name) return null;
    const trimmed = name.trim().replace(/\s+/g, ' ');
    return trimmed
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatDate(date: Date | string | null): Date | null {
    if (!date) return null;
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  removeNonASCIICharacters = (str: string): string => {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[^\x00-\x7F]/g, '');
  };
}
