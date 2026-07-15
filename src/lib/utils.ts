export function createClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function firstFieldError(errors: Record<string, string[]> | undefined, field: string): string | null {
  const messages = errors?.[field];
  return messages?.[0] ?? null;
}

export function formatApiMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error && typeof error === 'object') {
    const apiError = error as { message?: unknown; errors?: Record<string, string[]> };
    if (apiError.errors && typeof apiError.errors === 'object') {
      const fieldMessages = Object.values(apiError.errors)
        .flat()
        .filter((item): item is string => typeof item === 'string');
      if (fieldMessages.length > 0) {
        return fieldMessages.join('\n');
      }
    }
    if (typeof apiError.message === 'string' && apiError.message.trim()) {
      return apiError.message;
    }
  }
  return fallback;
}
