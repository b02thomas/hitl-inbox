#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { openStore } from '../src/store.mjs';
import { serve } from '../src/server.mjs';

const help = `hitl — lokale Entscheidungs-Inbox (JSON-Ausgabe)
  submit --file <json|->             Finding / Entscheidung dauerhaft einreichen
  list [--project NAME] [--run ID]    Inbox lesen
  show <id>                         Eintrag und Verlauf lesen
  check <id> --revision SHA          0 nur bei passender freigegebener Revision
  wait <id> --revision SHA [--timeout 60]  Auf Antwort warten (max. 60 Sekunden)
  comment <id> --file <json|->       Recherche / Rückfrage ergänzen
  complete <id> --file <json|->      Umsetzung mit Freigabeversion und Beleg melden
  serve [--port 47831]              Oberfläche auf Loopback starten
  example                          gültige synthetische Einreichung ausgeben
Daten: HITL_HOME oder ~/.local/share/hitl-inbox
Exit: 0 erfolgreich/freigegeben, 2 Fehler/Unbekannt, 4 wartet/abgelehnt/veraltet
Es gibt keinen CLI-Freigabebefehl. Menschen entscheiden in der Oberfläche.
`;
let store;
const print = value => process.stdout.write(`${JSON.stringify(value,null,2)}\n`);
try {
  const {values,positionals} = parseArgs({allowPositionals:true,options:{
    file:{type:'string'},project:{type:'string'},run:{type:'string'},revision:{type:'string'},
    timeout:{type:'string'},port:{type:'string'},help:{type:'boolean'},
  }});
  const [command,id,...extra] = positionals;
  if (!command || command === 'help' || values.help) { process.stdout.write(help); }
  else if (command === 'example') {
    print(JSON.parse(readFileSync(new URL('../examples/decision.json',import.meta.url),'utf8')));
  } else {
    const allowed = {submit:['file'],list:['project','run'],show:[],check:['revision'],wait:['revision','timeout'],comment:['file'],complete:['file'],serve:['port']};
    if (!(command in allowed)) throw new Error('Unbekannter Befehl; siehe hitl help');
    for (const key of Object.keys(values)) if (!allowed[command].includes(key)) throw new Error(`Option --${key} passt nicht zu ${command}`);
    const needsId = ['show','check','wait','comment','complete'].includes(command);
    if (extra.length || (needsId ? !id : id)) throw new Error('Ungültige Positionsargumente');
    const input = () => {
      if (!values.file) throw new Error('--file benötigt');
      const raw = readFileSync(values.file === '-' ? 0 : values.file,'utf8');
      if (Buffer.byteLength(raw) > 256000) throw new Error('Eingabe zu groß');
      return JSON.parse(raw);
    };
    store = openStore(process.env.HITL_HOME ?? join(homedir(),'.local/share/hitl-inbox'));
    if (command === 'submit') print(store.submit(input()));
    if (command === 'list') print(store.list(values.project,values.run));
    if (command === 'show') print({entry:store.get(id),events:store.events(id)});
    if (command === 'comment') print(store.comment(id,input()));
    if (command === 'complete') print(store.complete(id,input()));
    if (command === 'check' || command === 'wait') {
      if (!values.revision?.trim()) throw new Error('--revision benötigt');
      const seconds = Number(values.timeout ?? 60);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 60) throw new Error('--timeout: 1 bis 60 Sekunden');
      const deadline = Date.now() + seconds * 1000;
      let entry = store.get(id);
      while (command === 'wait' && entry.status === 'open' && Date.now() < deadline) {
        await setTimeout(500); entry = store.get(id);
      }
      const stale = entry.source.revision !== values.revision;
      const allowed = !stale && ['approved','completed'].includes(entry.status);
      print({id,allowed,status:entry.status,stale,version:entry.version,decision:entry.decision,
        instruction:allowed ? 'Nur die gewählte Option im ursprünglichen Scope umsetzen.' : 'Abhängige Arbeit stoppen. Empfehlung, Kommentar und Timeout sind keine Freigabe.'});
      process.exitCode = allowed ? 0 : 4;
    }
    if (command === 'serve') {
      const port = Number(values.port ?? 47831);
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Ungültiger Port');
      const {server,origin} = await serve(store,port);
      print({url:origin,storage:process.env.HITL_HOME ?? join(homedir(),'.local/share/hitl-inbox')});
      const serverStore = store;
      const close = () => server.close(() => { serverStore.close(); process.exit(0); });
      process.once('SIGINT',close); process.once('SIGTERM',close);
      store = undefined;
    }
  }
} catch (error) { process.stderr.write(`${JSON.stringify({error:error.message})}\n`); process.exitCode = 2; }
finally { store?.close(); }
