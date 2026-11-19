// Extra panel users (e.g. the boss), created by the owner from the panel.
// Stored in /data/users.json with scrypt hashes; the plain password is shown once and never kept.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

export const NAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
export const MAX_USERS = 20;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i
const KEYLEN = 32;
const COST = { N: 16384, r: 8, p: 1 };

const derive = (password, salt) =>
  new Promise((resolve, reject) => scrypt(String(password), salt, KEYLEN, COST, (e, key) => (e ? reject(e) : resolve(key))));

/** "k7mq-29xf-tc4p-wz8h": 16 characters from a 31-letter alphabet (~79 bits). */
export function newPassword() {
  let s = '';
  for (let i = 0; i < 16; i += 1) {
    s += ALPHABET[randomInt(ALPHABET.length)];
    if (i % 4 === 3 && i < 15) s += '-';
  }
  return s;
}

const DUMMY_SALT = randomBytes(16);

export class Users {
  constructor(file) {
    this.file = file;
    this.data = { v: 1, users: {} };
    this.error = null;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      if (raw && raw.v === 1 && raw.users && typeof raw.users === 'object') this.data = raw;
    } catch (e) {
      if (e.code !== 'ENOENT') {
        this.error = `No se pudo leer ${file}: ${e.code || e.message}`;
        console.error(this.error);
      }
    }
  }

  save() {
    const tmp = `${this.file}.tmp`;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  list() {
    return Object.entries(this.data.users)
      .map(([name, u]) => ({ name, created: u.created, reset: u.reset || null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name) {
    return Object.hasOwn(this.data.users, name) ? this.data.users[name] : null;
  }

  async setPassword(name, { isNew }) {
    const password = newPassword();
    const salt = randomBytes(16);
    const hash = await derive(password, salt);
    const prev = this.get(name);
    const now = new Date().toISOString();
    this.data.users[name] = {
      salt: salt.toString('base64'),
      hash: hash.toString('base64'),
      // A new version logs out every open session of this user.
      ver: prev ? prev.ver + 1 : 1,
      created: isNew || !prev ? now : prev.created,
      reset: isNew || !prev ? null : now
    };
    this.save();
    return password;
  }

  remove(name) {
    if (!this.get(name)) return false;
    delete this.data.users[name];
    this.save();
    return true;
  }

  /** The user's session version if the password is right, otherwise null. Same work either way. */
  async verify(name, password) {
    const u = this.get(name);
    const salt = u ? Buffer.from(u.salt, 'base64') : DUMMY_SALT;
    const key = await derive(password, salt);
    if (!u) return null;
    const want = Buffer.from(u.hash, 'base64');
    return want.length === key.length && timingSafeEqual(want, key) ? u.ver : null;
  }
}
