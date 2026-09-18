// mobile/app/(auth)/register.tsx
// FocusFlow Mobile — Registration Route

import React from 'react';
import { useRouter } from 'expo-router';
import { RegisterScreen } from '../../src/screens/auth/RegisterScreen';

export default function RegisterRoute() {
  const router = useRouter();

  const navigation = {
    navigate: (screen: string) => {
      if (screen === 'Login') {
        router.push('/(auth)/login');
      } else {
        router.push('/(auth)/register');
      }
    },
    goBack: () => router.back(),
  } as any;

  return <RegisterScreen navigation={navigation} />;
}
