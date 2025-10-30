export interface AccountTokens {
  accountId: string;
  accessToken: string;
  refreshToken: string;
  updatedAt: Date;
}

export interface AccountsRepo {
  get(accountId: string): Promise<AccountTokens | null>;
  save(tokens: AccountTokens): Promise<void>;
  update(accountId: string, patch: Partial<AccountTokens>): Promise<void>;
  delete(accountId: string): Promise<void>;
}

const store = new Map<string, AccountTokens>();

export const InMemoryAccountsRepo = (): AccountsRepo => ({
  async get(id) {
    return store.get(id) ?? null;
  },
  async save(t) {
    store.set(t.accountId, t);
  },
  async update(id, patch) {
    const current = store.get(id);
    if (!current) return;
    store.set(id, { ...current, ...patch, updatedAt: new Date() });
  },
  async delete(id) {
    store.delete(id);
  }
});