import type { AgentProfile } from '@fast-rental/shared';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';

export async function logActivity(input: {
  agentId: string;
  agentNom: string;
  typeAction: string;
  details: string;
  logementId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from('activite').insert({
    agent_id: input.agentId,
    agent_nom: input.agentNom,
    type_action: input.typeAction,
    details: input.details,
    logement_id: input.logementId ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function shouldLogLogin(agentId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data } = await supabaseAdmin
    .from('activite')
    .select('id')
    .eq('agent_id', agentId)
    .eq('type_action', 'connexion')
    .gte('created_at', oneHourAgo)
    .limit(1);
  return !data?.length;
}

export type ProfileRow = AgentProfile;
