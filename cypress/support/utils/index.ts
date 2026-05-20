export const normalizePhone = (phone: string): string => {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    return normalized;
  }
  return `0${normalized}`;
};

export const normalizeName = (name: string): string => {
  return name.trim().toLowerCase().split(/\s+/).sort().join(' ');
};
