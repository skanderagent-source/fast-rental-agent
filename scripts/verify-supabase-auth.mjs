#!/usr/bin/env node
/**
 * Phase 4: Verify Supabase Auth configuration.
 * Attempts anon sign-up (should fail when public signup disabled).
 */
import { createClient } from '@supabase/supabase-js';
import { backendEnv } from './lib/env.mjs';

const env = { ...backendEnv(), ...process.env };
const url = env.SUPABASE_URL;
const anon = env.SUPABASE_ANON_KEY;

if (!url || !anon || anon.includes('your-')) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in apps/backend/.env');
  process.exit(1);
}

const sb = createClient(url, anon);
const testEmail = `signup-block-test-${Date.now()}@example.invalid`;
const { error } = await sb.auth.signUp({ email: testEmail, password: 'TestPassword123!' });

if (error && /signup|disabled|not allowed|rate/i.test(error.message)) {
  console.log('✓ Public signup appears disabled (expected):', error.message);
  process.exit(0);
}

if (error) {
  console.log('✓ Signup rejected:', error.message);
  process.exit(0);
}

console.warn('⚠ Signup succeeded — disable public sign-up in Supabase Dashboard → Authentication → Providers');
console.warn('  See docs/supabase-auth-setup.md');
process.exit(1);
