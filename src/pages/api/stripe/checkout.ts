export const prerender = false;
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getAuthUserAsync } from '../../../lib/auth';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
    const user = await getAuthUserAsync(cookies);
    if (!user) return redirect('/login');

    const planSlug = url.searchParams.get('plan') || 'basico';
    const interval = url.searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly';

    const db = getSupabaseAdmin();
    const { data: plan } = await db.from('plans').select('*').eq('slug', planSlug).single();
    if (!plan) return new Response('Plan no encontrado', { status: 404 });

    const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

    const priceId = interval === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;

    if (!priceId) {
        // No Stripe price configured — redirect to contact
        return redirect('/soporte?reason=no-stripe');
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${url.origin}/dashboard?success=1`,
        cancel_url: `${url.origin}/planes`,
        customer_email: user.email,
        metadata: {
            userEmail: user.email,
            planSlug,
            interval,
        },
    });

    return redirect(session.url!);
};
