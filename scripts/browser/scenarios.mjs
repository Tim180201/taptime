const click = name => async p => p.getByRole('button', { name, exact: true }).first().click();
const summary = async p => p.locator('summary').click();
export const personPath = '/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09';
const scenario = (id, path, wait, steps = [], variant = id) => ({id,path,wait,steps,variant});
export const adminScenarios = [
  ...['warning','exceeded','manager','employee'].map(kind=>scenario(`quota-${kind}`,'/kunden','.customer-card',[],`quota-${kind}`)),
  scenario('quota-edit','/kunden','.customer-card',[async p=>p.getByRole('button',{name:/Werkstatt am Park/}).click(),click('Ändern')],'quota-warning'),
  scenario('quota-notice-view','/uebersicht','.quota-notice',[click('Ansehen')],'quota-warning'),
  ...['admin','manager','employee'].flatMap(role=>[
    scenario(`customers-${role}`,'/kunden','.customer-card',[],`customers-${role}`),
    scenario(`customers-${role}-detail`,'/kunden','.customer-card',[async p=>p.getByRole('button',{name:/Werkstatt am Park/}).click()],`customers-${role}`),
  ]),
  scenario('customers-empty','/kunden','.customers-view h2'),
  scenario('customers-error','/kunden','.customers-view [role="alert"]'),
  ...['login','login-error','forgot-password','signing-in'].map(id=>scenario(id,'/','h1')),
  ...['recovery','recovery-employee','recovery-standortleitung','recovery-administrator','recovery-busy','paused','forbidden','unavailable','loading'].map(id=>scenario(id,'/','main')),
  scenario('configuration','/','h1'),
  ...['welcome','welcome-invalid','welcome-unavailable'].map(id=>scenario(id,'/willkommen','main')),
  ...['welcome-success','welcome-error','welcome-busy'].map(id=>scenario(id,'/willkommen','form',[
    async p=>p.getByLabel('Neues Passwort').fill('synthetic example password'), click('Passwort setzen')
  ])),
  scenario('overview','/uebersicht','.metric-card'),
  ...['notice-saved','notice-location','notice-info'].map(id=>scenario(id,'/uebersicht','.notice')),
  { ...scenario('more','/uebersicht','.metric-card',[click('Mehr')], 'overview'), mobileOnly: true },
  { ...scenario('employee-more','/meine-zeiten?monat=2026-09','.calendar-grid',[click('Mehr')], 'employee-calendar'), mobileOnly: true },
  scenario('five-areas','/uebersicht','.metric-card'),
  scenario('employees','/beschaeftigte','.membership-tools'),
  scenario('departed','/beschaeftigte','.membership-tools',[async p=>{
    await p.getByRole('heading',{name:'Ausgeschiedene Mitarbeiter',exact:true}).waitFor();
    await p.getByRole('link',{name:'Erika Ausgeschieden'}).waitFor();
  }]),
  ...['running','long'].map(kind=>scenario('employee-revoke-'+kind,'/beschaeftigte','.membership-tools',[summary,click('Zugang entziehen'),async p=>{
    const dialog=p.getByRole('alertdialog');
    await dialog.getByRole('link',{name:'Zur Personenansicht'}).waitFor();
    if(kind==='long') {
      await dialog.getByText(/Diese Zeit läuft seit .*Bitte zuerst in der Personenansicht mit passender Endzeit beenden, dann den Zugang entziehen/).waitFor();
      if(!await dialog.getByRole('button',{name:'Zugang entziehen',exact:true}).isDisabled()) throw new Error('Overdue revocation must be disabled');
    } else {
      await dialog.getByText(/Läuft gerade eine Zeit, wird sie jetzt beendet: Werkstatt am Beispielweg/).waitFor();
      if(!await dialog.getByRole('button',{name:'Zugang entziehen',exact:true}).isEnabled()) throw new Error('Valid automatic stop must be enabled');
    }
  }])),
  scenario('employee-tools','/beschaeftigte','.membership-tools',[summary]),
  scenario('employee-role','/beschaeftigte','.membership-tools',[summary,click('Rolle bearbeiten')]),
  scenario('employee-revoke','/beschaeftigte','.membership-tools',[summary,click('Zugang entziehen')]),
  scenario('invitation','/beschaeftigte','.membership-tools',[click('Mitarbeiter hinzufügen')]),
  scenario('invitation-location','/beschaeftigte','.membership-tools',[click('Mitarbeiter hinzufügen')]),
  ...['error','busy'].map(state=>scenario('invitation-'+state,'/beschaeftigte','.membership-tools',[
    click('Mitarbeiter hinzufügen'), async p=>p.getByLabel('Name',{exact:true}).fill('Alexandra Beispiel'),
    async p=>p.getByLabel('E-Mail',{exact:true}).fill('person@example.invalid'),
    async p=>p.getByLabel('Hauptarbeitsstandort').selectOption('31000000-0000-4000-8000-000000000001'),
    click('Einladung senden'), async p=>p.locator(state==='error' ? '[role="alert"]' : 'button:disabled').first().waitFor(),
  ])),
  ...['empty','section-error','section-loading'].map(id=>scenario(id,'/beschaeftigte','main')),
  scenario('manager','/beschaeftigte','.membership-tools'),
  scenario('manager-reviews','/pruefungen','.review-case'),
  ...['Als Arbeitszeit übernehmen','Korrigieren','Ablehnen'].map((name,i)=>scenario('manager-review-form-'+i,'/pruefungen','.review-case',[click(name)])),
  scenario('manager-review-confirm','/pruefungen','[role="alertdialog"]'),
  scenario('manager-person',personPath,'.calendar-grid'),
  scenario('manager-time-add',personPath,'.calendar-grid',[click('Zeit hinzufügen')]),
  scenario('manager-time-correct',personPath,'.calendar-grid',[click('Ändern')]),
  scenario('manager-time-stop',personPath,'.calendar-grid',[click('Beenden')]),
  scenario('manager-own-stop','/meine-zeiten?monat=2026-09','.calendar-grid',[click('Beenden')]),
  scenario('manager-comment','/meine-zeiten?monat=2026-09','.calendar-grid',[click('Kommentar schreiben')]),
  scenario('reviews','/pruefungen','.review-case'),
  scenario('review-location','/pruefungen','.review-case',[async p=>p.getByText('Arbeitsziel keinem berechtigten Standort zugeordnet',{exact:true}).waitFor()]),
  ...['Als Arbeitszeit übernehmen','Korrigieren','Ablehnen'].map((name,i)=>scenario('review-form-'+i,'/pruefungen','.review-case',[click(name)])),
  scenario('review-confirm','/pruefungen','[role="alertdialog"]'),
  scenario('setup-locations','/einrichtung','.filter-chips',[click('Standorte')]),
  scenario('setup-targets','/einrichtung','.filter-chips',[click('Arbeitsziele')]),
  scenario('setup-targets-locations','/einrichtung','.filter-chips',[click('Arbeitsziele'),
    async p=>p.locator('form').filter({has:p.getByRole('button',{name:'Projekt anlegen',exact:true})})
      .getByRole('combobox').selectOption('31000000-0000-4000-8000-000000000002'),
  ]),
  scenario('setup-tags','/einrichtung','.filter-chips',[click('Karten')]),
  scenario('tag-confirm','/einrichtung','[role="alertdialog"]'),
  scenario('payroll','/lohnexport','.table-scroll'),
  scenario('payroll-month','/lohnexport?monat=2026-09','.table-scroll'),
  scenario('correction-confirm','/lohnexport','[role="alertdialog"]'),
  scenario('person',personPath,'.calendar-grid'),
  scenario('time-add',personPath,'.calendar-grid',[click('Zeit hinzufügen')]),
  scenario('time-correct',personPath,'.calendar-grid',[click('Ändern')]),
  scenario('time-stop',personPath,'.calendar-grid',[click('Beenden')]),
  ...['employee-void','manager-void','administrator-void'].flatMap(variant=>[
    {...scenario(variant,variant==='employee-void'?'/meine-zeiten?monat=2026-09':personPath,'.calendar-grid',[
      click('Zeiteintrag löschen'),async p=>p.getByLabel('Grund',{exact:true}).selectOption('other'),
      async p=>p.getByLabel('Kurze Begründung').fill('Dieser Eintrag wurde versehentlich doppelt nachgetragen.'),
    ]),variant},
    {...scenario(variant+'-history',variant==='employee-void'?'/meine-zeiten?monat=2026-09':personPath,'.calendar-grid',[
      click('Zeiteintrag löschen'),async p=>p.getByLabel('Grund',{exact:true}).selectOption('duplicate'),click('Löschen'),
      async p=>p.getByText(/Gelöscht am .* von Martin Beispiel/).waitFor(),
    ]),variant},
  ]),
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
  scenario('overview','/','table',[async p=>{
    const overlaps=await p.locator('.package-counts').evaluateAll(nodes=>nodes.some(node=>{
      const content=node.getBoundingClientRect();
      return [...node.closest('tr').children].filter(cell=>!cell.contains(node)).some(cell=>{
        const other=cell.getBoundingClientRect();
        return content.left<other.right && content.right>other.left && content.top<other.bottom && content.bottom>other.top;
      });
    }));
    if(overlaps) throw new Error('Package counts overlap another organization value');
  }]),
  ...['empty','error','loading'].map(id=>scenario(id,'/','main')),
  scenario('filter-empty','/','table',[async p=>p.getByLabel('Betrieb suchen').fill('Kein Treffer')]),
  scenario('create','/','table',[click('Betrieb anlegen')]),
  scenario('package-edit','/','table',[async p=>p.getByRole('button',{name:'Paket ändern',exact:true}).first().click(),
    async p=>p.getByLabel('Grund',{exact:true}).fill('Mehr Zugänge im Betrieb')]),
  ...['error','busy'].map(state=>scenario('create-'+state,'/','table',[
    click('Betrieb anlegen'), async p=>p.getByLabel('Name des Betriebs').fill('Beispiel Gebäudereinigung'),
    async p=>p.getByLabel('Name des ersten Administrators',{exact:true}).fill('Erika Beispiel'),
    async p=>p.getByLabel('E-Mail des ersten Administrators').fill('admin@example.invalid'), click('Anlegen und einladen'),
    async p=>p.locator(state==='error' ? '[role="alert"]' : 'button:disabled').first().waitFor(),
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
