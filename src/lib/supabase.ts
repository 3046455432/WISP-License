import { createClient } from '@supabase/supabase-js';
import { getConfigValue } from './config';

export async function getSupabaseAdmin() {
    return createClient(
        await getConfigValue('SUPABASE_URL'),
        await getConfigValue('SUPABASE_SERVICE_ROLE_KEY')
    );
}

export async function getSupabaseClient() {
    return createClient(
        await getConfigValue('SUPABASE_URL'),
        await getConfigValue('SUPABASE_ANON_KEY')
    );
}
