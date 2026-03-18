export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ cookies, redirect }) => {
    cookies.delete('wl_session', { path: '/' });
    return redirect('/login');
};
