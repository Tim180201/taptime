const click = name => async p => p.getByRole('button', { name, exact: true }).first().click();
const summary = async p => p.locator('summary').click();
export const personPath = '/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09';
const scenario = (id, path, wait, steps = [], variant = id) => ({id,path,wait,steps,variant});
export const adminScenarios = [
  ...['login','login-error','forgot-password','signing-in'].map(id=>scenario(id,'/','h1')),
  ...['recovery','recovery-busy','paused','forbidden','unavailable','loading'].map(id=>scenario(id,'/','main')),
  scenario('configuration','/','h1'),
  ...['welcome','welcome-invalid','welcome-unavailable'].map(id=>scenario(id,'/willkommen','main')),
  ...['welcome-success','welcome-error','welcome-busy'].map(id=>scenario(id,'/willkommen','form',[
    async p=>p.getByLabel('Neues Passwort').fill('synthetic example password'), click('Passwort setzen')
  ])),
  scenario('overview','/uebersicht','.metric-card'),
  { ...scenario('more','/uebersicht','.metric-card',[click('Mehr')], 'overview'), mobileOnly: true },
  { ...scenario('employee-more','/meine-zeiten?monat=2026-09','.calendar-grid',[click('Mehr')], 'employee-calendar'), mobileOnly: true },
  scenario('five-areas','/uebersicht','.metric-card'),
  scenario('employees','/beschaeftigte','.membership-tools'),
  scenario('employee-tools','/beschaeftigte','.membership-tools',[summary]),
  scenario('employee-role','/beschaeftigte','.membership-tools',[summary,click('Rolle bearbeiten')]),
  scenario('employee-revoke','/beschaeftigte','.membership-tools',[summary,click('Zugang entziehen')]),
  scenario('invitation','/beschaeftigte','.membership-tools',[click('Mitarbeiter hinzufügen')]),
  scenario('invitation-location','/beschaeftigte','.membership-tools',[click('Mitarbeiter hinzufügen')]),
  ...['error','busy'].map(state=>scenario('invitation-'+state,'/beschaeftigte','.membership-tools',[
    click('Mitarbeiter hinzufügen'), async p=>p.getByLabel('Name',{exact:true}).fill('Alexandra Beispiel'),
    async p=>p.getByLabel('E-Mail',{exact:true}).fill('person@example.invalid'),
    async p=>p.getByLabel('Heimatstandort').selectOption('31000000-0000-4000-8000-000000000001'),
    click('Einladung senden'), async p=>p.locator(state==='error' ? '[role="alert"]' : 'button:disabled').first().waitFor(),
  ])),
  ...['empty','section-error','section-loading'].map(id=>scenario(id,'/beschaeftigte','main')),
  scenario('manager','/beschaeftigte','.membership-tools'),
  scenario('reviews','/pruefungen','.review-case'),
  ...['Freigeben','Korrigieren','Ablehnen'].map((name,i)=>scenario('review-form-'+i,'/pruefungen','.review-case',[click(name)])),
  scenario('review-confirm','/pruefungen','[role="alertdialog"]'),
  scenario('setup-locations','/einrichtung','.filter-chips',[click('Standorte')]),
  scenario('setup-targets','/einrichtung','.filter-chips',[click('Arbeitsziele')]),
  scenario('setup-tags','/einrichtung','.filter-chips',[click('Tags')]),
  scenario('tag-confirm','/einrichtung','[role="alertdialog"]'),
  scenario('payroll','/lohnexport','.table-scroll'),
  scenario('correction-confirm','/lohnexport','[role="alertdialog"]'),
  scenario('person',personPath,'.calendar-grid'),
  scenario('time-add',personPath,'.calendar-grid',[click('Zeit hinzufügen')]),
  scenario('time-correct',personPath,'.calendar-grid',[click('Ändern')]),
  scenario('time-stop',personPath,'.calendar-grid',[click('Beenden')]),
  scenario('employee-calendar','/meine-zeiten?monat=2026-09','.calendar-grid'),
  scenario('employee-backfill','/meine-zeiten?monat=2026-09','.calendar-grid',[click('Zeit hinzufügen')]),
  scenario('employee-comment','/meine-zeiten?monat=2026-09','.calendar-grid',[click('Kommentar schreiben')]),
  scenario('manual','/manuell','fieldset'),
  scenario('manual-pending','/manuell','fieldset'),
];
export const operatorScenarios = [
  ...['login','checking','blocked','mfa-enroll','mfa-existing'].map(id=>scenario(id,'/','.auth')),
  ...['error','busy'].map(state=>scenario('login-'+state,'/','.auth',[
    async p=>p.getByLabel('E-Mail',{exact:true}).fill('operator@example.invalid'),
    async p=>p.getByLabel('Passwort',{exact:true}).fill('synthetic example password'), click('Anmelden'),
    async p=>p.getByRole(state==='error' ? 'alert' : 'status').waitFor(),
  ])),
  ...['error','busy'].map(state=>scenario('mfa-'+state,'/','.qr',[
    async p=>p.getByLabel('Code aus der Authenticator-App').fill('123456'), click('Code bestätigen'),
    async p=>p.locator(state==='error' ? '[role="alert"]' : 'button:disabled').waitFor(),
  ])),
  ...['configuration','storage-error'].map(id=>({...scenario(id,'/','.login h1'), production:true})),
  scenario('overview','/','table'),
  ...['empty','error','loading'].map(id=>scenario(id,'/','main')),
  scenario('filter-empty','/','table',[async p=>p.getByLabel('Betrieb suchen').fill('Kein Treffer')]),
  scenario('create','/','table',[click('Betrieb anlegen')]),
  ...['error','busy'].map(state=>scenario('create-'+state,'/','table',[
    click('Betrieb anlegen'), async p=>p.getByLabel('Name des Betriebs').fill('Beispiel Gebäudereinigung'),
    async p=>p.getByLabel('E-Mail des ersten Administrators').fill('admin@example.invalid'), click('Anlegen und einladen'),
    async p=>p.locator(state==='error' ? '[role="alert"]' : 'button:disabled').waitFor(),
  ])),
  ...['Pausieren','Fortsetzen'].flatMap((name,i)=>[
    scenario('status-form-'+i,'/','table',[click(name)]),
    scenario('status-confirm-'+i,'/','table',[click(name),async p=>p.getByLabel('Grund',{exact:true}).fill('Auf Wunsch des Betriebs'),click('Weiter zur Bestätigung')]),
    ...['error','busy'].map(state=>scenario('status-'+i+'-'+state,'/','table',[
      click(name),async p=>p.getByLabel('Grund',{exact:true}).fill('Auf Wunsch des Betriebs'),click('Weiter zur Bestätigung'),click(name+' bestätigen'),
      async p=>p.locator(state==='error' ? '[role="alert"]' : 'button:disabled').first().waitFor(),
    ])),
  ]),
  ...['audit','audit-empty'].map(id=>scenario(id,'/protokoll','.log, .card')),
  ...['audit','health'].flatMap(view=>['loading','error'].map(state=>scenario(view+'-'+state,view==='audit'?'/protokoll':'/betriebszustand','main',[async p=>p.getByRole(state==='error'?'alert':'status').waitFor()]))),
  ...['health','health-missing'].map(id=>scenario(id,'/betriebszustand','dl')),
];
