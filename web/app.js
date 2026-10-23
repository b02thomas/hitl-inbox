const $ = selector => document.querySelector(selector);
const labels = {open:'Entscheidung offen',clarification:'Rückfrage offen',approved:'Freigegeben',rejected:'Abgelehnt',completed:'Umsetzung gemeldet'};
let entries = [], selected, csrf;
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const error = message => { $('#error').hidden = !message; $('#error').textContent = message; };
async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Anfrage fehlgeschlagen');
  return data;
}
function badge(entry) { return element('span',labels[entry.status],`tag ${['open','clarification'].includes(entry.status) ? 'pending' : 'done'}`); }
function renderList() {
  const project = $('#project').value, status = $('#status').value;
  const visible = entries.filter(entry => (!project || project === entry.project) &&
    (status === 'all' || (status === 'pending' ? ['open','clarification'].includes(entry.status) : entry.status === status)));
  $('#count').textContent = `${visible.length} EINTRÄGE`;
  $('#entries').replaceChildren();
  for (const entry of visible) {
    const button = element('button',undefined,'entry');
    button.type = 'button'; button.setAttribute('aria-current',String(entry.id === selected));
    button.append(badge(entry),element('strong',entry.title),element('small',entry.project),element('small',`${entry.kind === 'finding' ? 'Finding' : 'Entscheidung'} · ${entry.run}`));
    button.addEventListener('click',() => select(entry.id));
    $('#entries').append(button);
  }
  return visible;
}
async function refresh() {
  try {
    error('');
    const data = await request('/api/inbox'); entries = data.entries; csrf = data.csrf;
    const previous = $('#project').value;
    $('#project').replaceChildren(new Option('Alle Projekte',''),...Array.from(new Set(entries.map(entry => entry.project))).map(project => new Option(project,project)));
    if (entries.some(entry => entry.project === previous)) $('#project').value = previous;
    const visible = renderList();
    if (selected && visible.some(entry => entry.id === selected)) await select(selected);
    else if (visible[0]) await select(visible[0].id);
    else empty();
  } catch (failure) { error(`Inbox nicht erreichbar: ${failure.message}. Es wurde nichts freigegeben.`); }
}
function empty() {
  selectionRequest += 1;
  selected = undefined;
  const card = element('div',undefined,'empty');
  card.append(element('h2','Hier ist gerade nichts zu entscheiden.'),element('p','Agenten reichen einen Befund mit „hitl submit --file …“ ein. Andere Zustände findest du im Filter.'));
  $('#detail').replaceChildren(card);
}
function section(number,title,...children) {
  const node = element('section',undefined,'section');
  const heading = element('div',undefined,'section-title');
  heading.append(element('span',number,'number'),element('h3',title));
  node.append(heading,...children); return node;
}
function paragraphCard(label,text) {
  const card = element('div',undefined,'card'); card.append(element('p',label,'eyebrow'),element('p',text)); return card;
}
let selectionRequest = 0;
async function select(id) {
  const token = ++selectionRequest;
  try {
    const data = await request(`/api/entries/${id}`);
    if (token !== selectionRequest) return;
    selected = id; renderList(); renderDetail(data.entry,data.events);
  } catch (failure) { error(failure.message); }
}
function renderDetail(entry,events) {
  const root = $('#detail'); root.replaceChildren();
  const head = element('div',undefined,'detail-head');
  head.append(badge(entry),element('h2',entry.title),element('p',entry.context),element('p',`${entry.project} · ${entry.run} · Revision ${entry.source.revision} · Version ${entry.version}`,'meta'),element('p',entry.source.reference,'reference'));
  root.append(head);
  const pair = element('div',undefined,'pair'); pair.append(paragraphCard('BEOBACHTET',entry.observed),paragraphCard('ERWARTET',entry.expected));
  const impact = paragraphCard('WARUM DAS RELEVANT IST',entry.impact); impact.classList.add('impact');
  const evidence = element('div');
  for (const item of entry.evidence) {
    const details = element('details',undefined,'card evidence');
    details.append(element('summary',item.label),element('p',item.reference,'reference'),element('p',item.detail)); evidence.append(details);
  }
  root.append(section('01','Ist-Zustand & Belege',pair,impact,evidence));
  const options = element('div',undefined,'card'); options.append(element('h3',entry.question));
  const tabs = element('div',undefined,'tabs'), panel = element('div');
  tabs.setAttribute('aria-label','Lösungsoptionen vergleichen');
  const showOption = option => {
    for (const button of tabs.children) button.setAttribute('aria-pressed',String(button.dataset.option === option.id));
    panel.replaceChildren(element('h3',`${option.id} · ${option.title}`),element('p',option.description));
    const comparison = element('div',undefined,'proscons');
    for (const [key,title] of [['pros','DAFÜR'],['cons','DAGEGEN']]) {
      const column = element('div'), list = element('ul');
      for (const point of option[key]) list.append(element('li',point));
      column.append(element('p',title,'eyebrow'),list); comparison.append(column);
    }
    panel.append(comparison);
  };
  for (const option of entry.options) {
    const button = element('button',`${option.id} · ${option.title}`); button.type = 'button'; button.dataset.option = option.id;
    button.addEventListener('click',() => showOption(option)); tabs.append(button);
  }
  options.append(tabs,panel);
  showOption(entry.options.find(option => option.id === (entry.decision?.optionId ?? entry.recommendation.optionId)));
  const recommendation = element('div',undefined,'recommendation');
  recommendation.append(element('p',`EMPFEHLUNG · ${entry.recommendation.optionId}`,'eyebrow'),element('p',entry.recommendation.reason)); options.append(recommendation);
  root.append(section('02','Optionen vergleichen',options));
  if (['open','clarification'].includes(entry.status)) root.append(section('03','Deine Entscheidung',decisionForm(entry)));
  if (entry.decision) {
    const decision = element('div',undefined,'card decision-result');
    decision.append(element('h3',`${labels[entry.status]}${entry.decision.optionId ? ` · Option ${entry.decision.optionId}` : ''}`),element('p',entry.decision.note),element('p',`${entry.decision.actor} · ${new Date(entry.decision.at).toLocaleString('de-DE')}`,'meta'));
    root.append(section('04','Gespeicherte Rückmeldung',decision));
  }
  if (entry.resolution) root.append(section('05','Umsetzungsnachweis des Agenten',paragraphCard(entry.resolution.revision,entry.resolution.evidence)));
  const history = element('ol',undefined,'history');
  const names = {'submitted':'Eingereicht','human-decision':'Menschliche Rückmeldung','completion-reported':'Umsetzung gemeldet','comment':'Ergänzung'};
  for (const event of events) {
    const item = element('li'); item.append(element('strong',names[event.type]),element('time',new Date(event.at).toLocaleString('de-DE')));
    if (event.type === 'comment') item.append(element('p',`${event.body.actor}: ${event.body.text}`));
    if (event.type === 'human-decision') item.append(element('p',`${event.body.actor}: ${event.body.action}${event.body.optionId ? ` · ${event.body.optionId}` : ''} — ${event.body.note}`));
    history.append(item);
  }
  root.append(section('06','Verlauf',history));
}
function decisionForm(entry) {
  const form = element('form',undefined,'card decision');
  const nameLabel = element('label','Dein Name'), name = element('input'); name.name = 'actor'; name.required = true; name.maxLength = 200; name.autocomplete = 'name'; nameLabel.append(name);
  const optionLabel = element('label','Option zur Freigabe'), select = element('select'); select.name = 'option';
  select.append(new Option('Bewusst auswählen …',''),...entry.options.map(option => new Option(`${option.id} · ${option.title}`,option.id))); optionLabel.append(select);
  const grid = element('div',undefined,'form-grid'); grid.append(nameLabel,optionLabel);
  const noteLabel = element('label','Entscheidung, Einschränkung oder Rückfrage'), note = element('textarea'); note.name = 'note'; note.required = true; note.maxLength = 12000; noteLabel.append(note);
  const actions = element('div',undefined,'actions');
  for (const [action,title] of [['approve','Option freigeben'],['clarify','Rückfrage stellen'],['reject','Ablehnen']]) {
    const button = element('button',title,action === 'approve' ? 'primary' : ''); button.type = 'submit'; button.value = action; actions.append(button);
  }
  form.append(element('p','Deine Antwort wird dauerhaft gespeichert. Die Optionsvorschau trifft keine Auswahl für dich.'),grid,noteLabel,actions);
  form.addEventListener('submit',async event => {
    event.preventDefault(); error('');
    const action = event.submitter?.value;
    if (!action) return;
    if (action === 'approve' && !select.value) { error('Bitte eine Option ausdrücklich auswählen.'); select.focus(); return; }
    for (const button of actions.children) button.disabled = true;
    try {
      const decision = {version:entry.version,action,note:note.value,actor:name.value};
      if (action === 'approve') decision.optionId = select.value;
      await request(`/api/entries/${entry.id}/decision`,{method:'POST',headers:{'Content-Type':'application/json','X-HITL-CSRF':csrf},body:JSON.stringify(decision)});
      $('#notice').textContent = 'Deine Antwort ist gespeichert. Der Agent kann sie jetzt auslesen.';
      $('#status').value = 'all'; await refresh();
    } catch (failure) { error(`Nicht gespeichert: ${failure.message}`); }
    finally { for (const button of actions.children) button.disabled = false; }
  });
  return form;
}
$('#refresh').addEventListener('click',refresh);
for (const id of ['#project','#status']) $(id).addEventListener('change',() => {
  const visible = renderList(); if (visible[0]) select(visible[0].id); else empty();
});
await refresh();
