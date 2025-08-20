import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(import.meta.env.VITE_NEON_DB || process.env.NEON_DB!);

export function generateBackupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${pick(4)}-${pick(4)}-${pick(4)}-${pick(4)}`;
}

export async function storeBackupCodes(userId: string, codes: string[]) {
  for (const code of codes) {
    const hash = await bcrypt.hash(code, 12);
    await sql`INSERT INTO backup_codes (user_id, code_hash) VALUES (${userId}, ${hash})`;
  }
}

export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const rows = await sql`SELECT id, code_hash, used FROM backup_codes WHERE user_id = ${userId} AND used = FALSE` as any[];
  for (const row of rows) {
    if (await bcrypt.compare(code, row.code_hash)) {
      await sql`UPDATE backup_codes SET used = TRUE WHERE id = ${row.id}`;
      return true;
    }
  }
  return false;
} 