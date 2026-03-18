import { createClient } from '@supabase/supabase-js';

// Cliente estático para obtener la configuración inicial (usando variables de entorno)
const staticDb = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getConfigValue(key: string, defaultValue: string = ''): Promise<string> {
    try {
        const { data, error } = await staticDb
            .from('PlatformConfig')
            .select('value')
            .eq('key', key)
            .single();
        
        if (error || !data) return import.meta.env[key] || defaultValue;
        return data.value;
    } catch (e) {
        return import.meta.env[key] || defaultValue;
    }
}

export async function getAllConfigs() {
    const keys = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'STRIPE_SECRET_KEY',
        'PUBLIC_STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'OWNER_EMAIL'
    ];
    
    const { data } = await staticDb.from('PlatformConfig').select('*');
    const configMap: Record<string, string> = {};
    
    keys.forEach(k => {
        const dbValue = data?.find(d => d.key === k)?.value;
        configMap[k] = dbValue || import.meta.env[k] || '';
    });
    
    return configMap;
}
