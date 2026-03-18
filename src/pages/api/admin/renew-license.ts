export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { getAuthUserAsync, isAdmin } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const user = await getAuthUserAsync(cookies);
    if (!user || !isAdmin(user)) return new Response('Unauthorized', { status: 401 });

    const form = await request.formData();
    const id = form.get('id')?.toString();
    if (!id) return redirect('/admin/licencias');

    const db = getSupabaseAdmin();
    const { data: lic } = await db.from('licenses').select('expires_at').eq('id', id).single();
    if (!lic) return redirect('/admin/licencias');

    const expiry = new Date(lic.expires_at);
    expiry.setDate(expiry.getDate() + 30);

    await db.from('licenses').update({ expires_at: expiry.toISOString(), status: 'active' }).eq('id', id);
    return redirect('/admin/licencias');
};
