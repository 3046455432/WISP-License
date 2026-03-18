export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { getAuthUserAsync, isAdmin } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const user = await getAuthUserAsync(cookies);
    if (!user || !isAdmin(user)) return new Response('Unauthorized', { status: 401 });

    const form = await request.formData();
    const db = getSupabaseAdmin();

    const allowedKeys = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'STRIPE_SECRET_KEY',
        'PUBLIC_STRIPE_PUBLISHABLE_KEY',
        'OWNER_EMAIL'
    ];

    for (const key of allowedKeys) {
        const value = form.get(key)?.toString();
        if (value !== undefined) {
            // Upsert en la tabla PlatformConfig
            const { error } = await db
                .from('PlatformConfig')
                .upsert({ key, value }, { onConflict: 'key' });
            
            if (error) console.error(`Error saving ${key}:`, error);
        }
    }

    return redirect('/admin/configuracion?saved=1');
};
