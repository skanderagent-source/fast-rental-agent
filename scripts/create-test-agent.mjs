#!/usr/bin/env node
/**
 * Creates the skander test agent per Phase 25 Definition of Done.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.TEST_AGENT_EMAIL ?? 'skander@test.local';
const password = process.env.TEST_AGENT_PASSWORD ?? 'ChangeMe123!';
const nom = process.env.TEST_AGENT_NOM ?? 'Skander Test';

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nom, role: 'agent' },
});
if (error && !error.message.includes('already')) {
  console.error(error.message);
  process.exit(1);
}

const userId = created?.user?.id;
if (userId) {
  await admin.from('agents').upsert({
    id: userId,
    email,
    nom,
    role: 'agent',
    actif: true,
    must_change_password: false,
  });
}

console.log(`Test agent ready: ${email}`);
