export function object(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objekt erwartet');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unbekanntes Feld: ${key}`);
  for (const key of required) if (!(key in value)) throw new Error(`Fehlendes Feld: ${key}`);
}
export function text(value, name, max = 12000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name}: nichtleerer Text bis ${max} Zeichen erwartet`);
  return value;
}
export function choice(value, values, name) {
  if (!values.includes(value)) throw new Error(`${name}: erwartet ${values.join(', ')}`);
}
function list(value, name, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${name}: ${min}–${max} Einträge erwartet`);
}
export function validateSubmission(value) {
  object(value, ['key','project','run','kind','title','context','observed','expected','impact','evidence','options','recommendation','question','source']);
  for (const key of ['key','project','run','title']) text(value[key], key, 200);
  choice(value.kind, ['finding','decision'], 'kind');
  for (const key of ['context','observed','expected','impact','question']) text(value[key], key);
  object(value.source, ['revision','reference']);
  text(value.source.revision, 'source.revision', 200);
  text(value.source.reference, 'source.reference', 2000);
  list(value.evidence, 'evidence', 1, 20);
  for (const item of value.evidence) {
    object(item, ['label','reference','detail']);
    for (const key of ['label','reference','detail']) text(item[key], `evidence.${key}`);
  }
  list(value.options, 'options', 1, 6);
  const ids = new Set();
  for (const option of value.options) {
    object(option, ['id','title','description','pros','cons']);
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(option.id)) throw new Error('Ungültige option.id');
    if (ids.has(option.id)) throw new Error('Doppelte option.id');
    ids.add(option.id);
    for (const key of ['title','description']) text(option[key], `options.${key}`);
    for (const key of ['pros','cons']) {
      list(option[key], key, 1, 6);
      for (const item of option[key]) text(item, key, 2000);
    }
  }
  object(value.recommendation, ['optionId','reason']);
  if (!ids.has(value.recommendation.optionId)) throw new Error('Empfehlung referenziert unbekannte Option');
  text(value.recommendation.reason, 'recommendation.reason');
  return value;
}
export function validateDecision(value, submission) {
  object(value, ['version','action','optionId','note','actor'], ['version','action','note','actor']);
  if (!Number.isSafeInteger(value.version) || value.version < 1) throw new Error('Ungültige Version');
  choice(value.action, ['approve','reject','clarify'], 'action');
  text(value.note, 'Begründung');
  text(value.actor, 'Name', 200);
  if (value.action === 'approve') {
    if (!submission.options.some(option => option.id === value.optionId)) throw new Error('Unbekannte Option');
  } else if ('optionId' in value) throw new Error('Option nur bei Freigabe erlaubt');
  return value;
}
