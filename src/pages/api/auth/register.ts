export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { signToken } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const form = await request.formData();
    const email = form.get('email')?.toString().toLowerCase().trim();
    const password = form.get('password')?.toString();
    const fullName = form.get('fullName')?.toString();
    const companyName = form.get('companyName')?.toString();

    if (!email || !password) return redirect('/register?error=missing');

    const db = getSupabaseAdmin();

    // Check if already exists
    const { data: existing } = await db.from('user_profiles').select('id').eq('email', email).single();
    if (existing) return redirect('/register?error=exists');

    const hash = await bcrypt.hash(password, 10);

    // Create user profile (password stored hashed in profiles)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { data: profile, error } = await db.from('user_profiles').insert({
        email,
        full_name: fullName,
        company_name: companyName,
        role: email === import.meta.env.OWNER_EMAIL ? 'admin' : 'client',
        current_plan_slug: 'trial',
        password_hash: hash,
    }).select().single();

    if (error || !profile) {
        console.error('Register error:', error);
        return redirect('/register?error=server');
    }

    // Create a pending trial license
    await db.from('licenses').insert({
        client_name: companyName || fullName || email,
        client_email: email,
        plan: 'trial',
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        max_routers: 3,
        notes: `Registro via portal web. Usuario: ${fullName}`,
    });

    const token = await signToken({
        id: profile.id,
        email: profile.email,
        role: profile.role as 'client' | 'admin',
        companyName: profile.company_name,
    });

    cookies.set('wl_session', token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
    });

    return redirect('/dashboard');
};
