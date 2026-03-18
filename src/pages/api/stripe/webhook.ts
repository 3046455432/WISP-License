export const prerender = false;
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
    const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
    const sig = request.headers.get('stripe-signature');
    const body = await request.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig!, import.meta.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return new Response('Webhook signature invalid', { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userEmail, planSlug, interval } = session.metadata || {};

        if (userEmail && planSlug) {
            const db = getSupabaseAdmin();
            const { data: plan } = await db.from('plans').select('*').eq('slug', planSlug).single();

            const durationDays = interval === 'yearly' ? 365 : 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + durationDays);

            // Upsert license for this user
            const { data: existing } = await db.from('licenses').select('id').eq('client_email', userEmail).single();
            if (existing) {
                await db.from('licenses').update({
                    status: 'active',
                    plan: planSlug,
                    expires_at: expiresAt.toISOString(),
                    max_routers: plan?.max_routers ?? 10,
                }).eq('id', existing.id);
            } else {
                const { data: profile } = await db.from('user_profiles').select('company_name').eq('email', userEmail).single();
                await db.from('licenses').insert({
                    client_name: profile?.company_name || userEmail,
                    client_email: userEmail,
                    plan: planSlug,
                    status: 'active',
                    expires_at: expiresAt.toISOString(),
                    max_routers: plan?.max_routers ?? 10,
                    notes: `Pago via Stripe. Session: ${session.id}`,
                });
            }

            // Update user profile plan
            await db.from('user_profiles').update({ current_plan_slug: planSlug }).eq('email', userEmail);
            console.log(`[STRIPE] Licencia activada para ${userEmail} — Plan: ${planSlug}`);
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as Stripe.Subscription;
        const email = (sub.metadata as any)?.userEmail;
        if (email) {
            const db = getSupabaseAdmin();
            await db.from('licenses').update({ status: 'expired' }).eq('client_email', email);
        }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
};
