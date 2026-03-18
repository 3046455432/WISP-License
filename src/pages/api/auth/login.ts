export const prerender = false;
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { signToken } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const form = await request.formData();
    const email = form.get('email')?.toString().toLowerCase().trim();
    const password = form.get('password')?.toString();

    if (!email || !password) return redirect('/login?error=missing');

    const db = getSupabaseAdmin();
    const { data: profile } = await db
        .from('user_profiles')
        .select('id, email, role, company_name, password_hash')
        .eq('email', email)
        .single();

    if (!profile || !profile.password_hash) return redirect('/login?error=invalid');

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) return redirect('/login?error=invalid');

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
