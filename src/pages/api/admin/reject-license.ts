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

    const db = await getSupabaseAdmin();
    await db.from('licenses').delete().eq('id', id);
    return redirect('/admin/licencias');
};
