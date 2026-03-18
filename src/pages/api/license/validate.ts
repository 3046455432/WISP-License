export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { isOwner } from '../../lib/auth';

const GRACE_PERIOD_DAYS = 3;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { token } = await request.json();
        if (!token) return json({ valid: false, error: 'Token requerido' }, 400);

        const db = await getSupabaseAdmin();
        const { data: license, error } = await db
            .from('licenses')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !license) return json({ valid: false, status: 'not_found', error: 'Licencia no encontrada' }, 404);

        const now = new Date();
        const expiry = new Date(license.expires_at);
        const graceEnd = new Date(expiry);
        graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
        const isExpired = expiry < now;
        const inGrace = isExpired && now <= graceEnd;

        // Update last_validated_at
        await db.from('licenses').update({ last_validated_at: now.toISOString() }).eq('id', license.id);

        const isOwnerLicense = isOwner(license.client_email);

        if (isOwnerLicense) {
            return json({
                valid: true,
                status: 'active',
                gracePeriod: false,
                expiresAt: '2099-12-31T23:59:59Z',
                plan: 'Empresarial (Administrador)',
                clientName: license.client_name,
                maxRouters: -1, // Unlimited
            });
        }

        if (license.status === 'pending') {
            return json({ valid: false, status: 'pending', clientName: license.client_name, token: license.token });
        }
        if (license.status === 'suspended' || license.status === 'cancelled') {
            return json({ valid: false, status: license.status });
        }
        if (isExpired && !inGrace) {
            return json({ valid: false, status: 'expired', expiresAt: license.expires_at });
        }

        return json({
            valid: true,
            status: license.status,
            gracePeriod: inGrace,
            expiresAt: license.expires_at,
            plan: license.plan,
            clientName: license.client_name,
            maxRouters: license.max_routers,
        });
    } catch (err) {
        return json({ valid: false, error: 'Error interno' }, 500);
    }
};

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}
