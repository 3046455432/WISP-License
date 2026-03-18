export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { getAuthUserAsync, isAdmin } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const user = await getAuthUserAsync(cookies);
    if (!user || !isAdmin(user)) return new Response('Unauthorized', { status: 401 });

    const form = await request.formData();
    const id = form.get('id')?.toString();

    const db = await getSupabaseAdmin();
    await db.from('plans').update({
        name: form.get('name')?.toString(),
        price_monthly: parseFloat(form.get('price_monthly')?.toString() || '0'),
        price_yearly: parseFloat(form.get('price_yearly')?.toString() || '0'),
        max_routers: parseInt(form.get('max_routers')?.toString() || '5'),
        stripe_price_id_monthly: form.get('stripe_price_id_monthly')?.toString() || null,
        is_featured: form.get('is_featured') === 'true',
        is_active: form.get('is_active') === 'true',
    }).eq('id', id);

    return redirect('/admin/planes');
};
