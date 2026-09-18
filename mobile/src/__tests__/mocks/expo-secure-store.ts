// mobile/src/__tests__/mocks/expo-secure-store.ts
const store = new Map<string, string>();

export const getItemAsync = async (key: string): Promise<string | null> => {
  return store.get(key) || null;
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  store.set(key, value);
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  store.delete(key);
};
