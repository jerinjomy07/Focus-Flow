// src/app/api/auth/[...nextauth]/route.ts
// FocusFlow — Auth.js v5 Route Handlers

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
export const runtime = 'nodejs';
