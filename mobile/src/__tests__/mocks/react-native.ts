// mobile/src/__tests__/mocks/react-native.ts
export const AppState = {
  currentState: 'active',
  addEventListener: () => ({
    remove: () => {},
  }),
};

export const Platform = {
  OS: 'android',
  select: (objs: Record<string, any>) => objs.android || objs.default,
};
