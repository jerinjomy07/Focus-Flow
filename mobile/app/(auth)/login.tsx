// mobile/app/(auth)/login.tsx
// FocusFlow Mobile — Login Route

import React from 'react';
import { useRouter } from 'expo-router';
import { LoginScreen } from '../../src/screens/auth/LoginScreen';

export default function LoginRoute() {
  const router = useRouter();

  const navigation = {
    navigate: (screen: string) => {
      if (screen === 'Register') {
        router.push('/(auth)/register');
      } else {
        router.push('/(auth)/login');
      }
    },
    goBack: () => router.back(),
  } as any;

  return <LoginScreen navigation={navigation} />;
}
