export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { clientName, hostname, serverIp, clientEmail } = await request.json();
        if (!clientName || !hostname) return json({ success: false, error: 'clientName y hostname requeridos' }, 400);

        const db = getSupabaseAdmin();

        // Check if already requested by this hostname
        const { data: existing } = await db.from('licenses').select('id, status, token').eq('hostname', hostname).single();
        if (existing) {
            return json({ success: true, token: existing.token, status: existing.status, alreadyExists: true });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 14);

        const { data: license, error } = await db.from('licenses').insert({
            client_name: clientName,
            client_email: clientEmail || null,
            hostname,
            server_ip: serverIp || null,
            plan: 'trial',
            status: 'pending',
            expires_at: expiresAt.toISOString(),
            max_routers: 3,
            notes: `Auto-solicitud desde install.sh. Hostname: ${hostname}`,
        }).select().single();

        if (error || !license) return json({ success: false, error: 'Error al crear solicitud' }, 500);

        return json({ success: true, token: license.token, status: 'pending' }, 201);
    } catch (err) {
        return json({ success: false, error: 'Error interno' }, 500);
    }
};

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
