import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
    import.meta.env.JWT_SECRET || 'wisp_license_secret'
);

export interface LicenseUser {
    id: string;
    email: string;
    role: 'client' | 'admin';
    companyName?: string;
}

export async function signToken(payload: LicenseUser): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET);
}

export async function verifyToken(token: string): Promise<LicenseUser | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as LicenseUser;
    } catch {
        return null;
    }
}

export function getAuthUser(cookies: any): LicenseUser | null {
    const token = cookies.get('wl_session')?.value;
    if (!token) return null;
    // Sync verification not possible with jose — use middleware pattern
    return null; // will be populated by middleware
}

export async function getAuthUserAsync(cookies: any): Promise<LicenseUser | null> {
    const token = cookies.get('wl_session')?.value;
    if (!token) return null;
    return verifyToken(token);
}

export function isOwner(email: string): boolean {
    return email.toLowerCase() === (import.meta.env.OWNER_EMAIL || '').toLowerCase();
}

export function isAdmin(user: LicenseUser | null): boolean {
    return !!user && (user.role === 'admin' || isOwner(user.email));
}
