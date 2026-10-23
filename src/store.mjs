import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { validateSubmission, validateDecision, object, text } from './schema.mjs';

// SQLite serializes concurrent agents; submission, decision and audit event share a transaction.
export function openStore(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, 'inbox.sqlite'));
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, project TEXT NOT NULL, run TEXT NOT NULL, request_key TEXT NOT NULL,
      digest TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL,
      created TEXT NOT NULL, updated TEXT NOT NULL, decision TEXT, resolution TEXT,
      UNIQUE(project,run,request_key));
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY, entry_id TEXT NOT NULL, at TEXT NOT NULL, type TEXT NOT NULL, body TEXT NOT NULL);`);
  const decode = row => row && ({ id: row.id, ...JSON.parse(row.body), status: row.status,
    version: row.version, created: row.created, updated: row.updated,
    decision: row.decision ? JSON.parse(row.decision) : null,
    resolution: row.resolution ? JSON.parse(row.resolution) : null });
  const get = id => {
    const value = decode(db.prepare('SELECT * FROM entries WHERE id=?').get(id));
    if (!value) throw new Error('Eintrag nicht gefunden');
    return value;
  };
  const transaction = work => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const event = (id, type, value, at) => db.prepare('INSERT INTO events(entry_id,at,type,body) VALUES(?,?,?,?)').run(id,at,type,JSON.stringify(value));
  return {
    close: () => db.close(), get,
    list: (project, run) => db.prepare('SELECT * FROM entries WHERE (? IS NULL OR project=?) AND (? IS NULL OR run=?) ORDER BY created DESC').all(project ?? null,project ?? null,run ?? null,run ?? null).map(decode),
    events: id => { get(id); return db.prepare('SELECT at,type,body FROM events WHERE entry_id=? ORDER BY seq').all(id).map(row => ({...row, body: JSON.parse(row.body)})); },
    submit: value => {
      validateSubmission(value);
      // A canonical key order makes transport formatting irrelevant to retry deduplication.
      const canonical = item => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object'
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
      const body = JSON.stringify(canonical(value));
      const digest = createHash('sha256').update(body).digest('hex');
      return transaction(() => {
        const previous = db.prepare('SELECT * FROM entries WHERE project=? AND run=? AND request_key=?').get(value.project,value.run,value.key);
        if (previous) {
          if (previous.digest !== digest) throw new Error('Konflikt: gleicher key mit anderem Inhalt. Für neue Sachlage neuen key verwenden.');
          return get(previous.id);
        }
        const id = randomUUID(), at = new Date().toISOString();
        db.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,value.project,value.run,value.key,digest,body,'open',1,at,at,null,null);
        event(id,'submitted',value,at);
        return get(id);
      });
    },
    decide: (id, decision) => transaction(() => {
      const entry = get(id);
      validateDecision(decision, entry);
      if (entry.version !== decision.version || !['open','clarification'].includes(entry.status)) throw new Error('Konflikt: Eintrag wurde bereits geändert. Neu laden.');
      const at = new Date().toISOString();
      const status = {approve:'approved',reject:'rejected',clarify:'clarification'}[decision.action];
      db.prepare('UPDATE entries SET status=?,version=version+1,updated=?,decision=? WHERE id=?').run(status,at,JSON.stringify({...decision,at}),id);
      event(id,'human-decision',decision,at);
      return get(id);
    }),
    complete: (id, value) => transaction(() => {
      object(value, ['version','revision','evidence']);
      text(value.revision,'revision',200); text(value.evidence,'evidence');
      const entry = get(id);
      if (entry.status !== 'approved' || value.version !== entry.version) throw new Error('Abschluss benötigt die aktuelle Freigabeversion');
      const at = new Date().toISOString();
      db.prepare("UPDATE entries SET status='completed',version=version+1,updated=?,resolution=? WHERE id=?").run(at,JSON.stringify({...value,at}),id);
      event(id,'completion-reported',value,at);
      return get(id);
    }),
    comment: (id, value) => transaction(() => {
      object(value,['text','actor']); text(value.text,'text'); text(value.actor,'actor',200); get(id);
      event(id,'comment',value,new Date().toISOString());
      return get(id);
    }),
  };
}
