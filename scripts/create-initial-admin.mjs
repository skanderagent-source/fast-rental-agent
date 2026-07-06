import { createClient } from '@supabase/supabase-js';

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_PASSWORD',
  'INITIAL_ADMIN_NAME',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const email = process.env.INITIAL_ADMIN_EMAIL;
const password = process.env.INITIAL_ADMIN_PASSWORD;
const nom = process.env.INITIAL_ADMIN_NAME;

let userId;

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nom, role: 'admin' },
});

if (createError) {
  if (!createError.message.toLowerCase().includes('already')) {
    console.error('Failed to create auth user:', createError.message);
    process.exit(1);
  }
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('User exists but lookup failed:', listError.message);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email === email);
  if (!existing) {
    console.error('User exists but could not be found by email');
    process.exit(1);
  }
  userId = existing.id;
} else {
  userId = created.user.id;
}

const { error: profileError } = await supabase.from('agents').upsert(
  {
    id: userId,
    email,
    nom,
    role: 'admin',
    actif: true,
    must_change_password: true,
  },
  { onConflict: 'id' },
);

if (profileError) {
  console.error('Failed to upsert agents profile:', profileError.message);
  process.exit(1);
}

console.log(`Initial admin ready: ${email} (id: ${userId})`);
console.log('Password was NOT printed. Communicate it to the admin securely.');
