# Legal, Privacy and Commercial Readiness — Start Package

- Status: **INTERNAL WORKING DRAFT — NOT LEGAL ADVICE, NOT APPROVED, NOT FOR PUBLICATION**
- Date: 2026-07-28
- Owner: Human Architect + Technical Lead
- External decision authority: qualified German/EU legal and privacy counsel
- Roadmap: Block H, DT-079–DT-084; DA6 privacy/operations dependency; DA8 trust/privacy pages
- Scope: B2B v1 working hypothesis only; B2C/consumer terms remain out of scope unless explicitly
  selected

## 1. Purpose and safety boundary

Starting now is appropriate because privacy/legal review consumes elapsed calendar time and DA6
cannot truthfully finalize retention, backup, incident or production-data behavior without it.

This package:

- records the repository-derived data inventory;
- separates likely controller and processor activities for external verification;
- defines the required Datenschutz/TOM/AVV/AGB/Impressum work products;
- identifies missing Human/company/provider/policy values; and
- prepares a bounded external-review handover.

It is not a publishable privacy notice, binding AGB, a concluded legal basis, a completed
processing register, or approval to process production/pilot personal data.

## 2. Current official legal reference set

The external reviewer must verify the current law and applicability at review/publication time.
Starting references are:

- [GDPR / DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de), especially Articles
  5, 6, 12–14, 15–22, 25, 28, 30, 32–36 and 44 onward;
- [BDSG § 26 — Beschäftigtendaten](https://www.gesetze-im-internet.de/bdsg_2018/__26.html);
- [BetrVG § 87 — Mitbestimmungsrechte](https://www.gesetze-im-internet.de/betrvg/__87.html);
- [BAG 1 ABR 22/21 — Arbeitszeiterfassung](https://www.bundesarbeitsgericht.de/entscheidung/1-abr-22-21/);
- [DDG § 5 — Anbieterinformationen](https://www.gesetze-im-internet.de/ddg/__5.html);
- [TDDDG § 25 — Endeinrichtungszugriff](https://www.gesetze-im-internet.de/ttdsg/__25.html);
- [BGB § 305](https://www.gesetze-im-internet.de/bgb/__305.html),
  [§ 307](https://www.gesetze-im-internet.de/bgb/__307.html) and
  [§ 310](https://www.gesetze-im-internet.de/bgb/__310.html) for AGB use and B2B scope; and
- [EDPB Guidelines 07/2020 — Controller and Processor](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en).

References are research inputs, not legal conclusions.

## 3. Working role hypothesis requiring external confirmation

For an employer-customer's employee time tracking:

- the customer/employer is expected to determine the employment purpose and essential use and is
  therefore the likely controller;
- TapTim.e is expected to process Product data on documented customer instructions and is
  therefore the likely processor; and
- TapTim.e remains an independent controller for its own contract, billing, contact, security,
  abuse-prevention, legal-compliance and website operations where it determines purposes/means.

Actual roles are functional and cannot be selected by contract wording alone. Support access,
product telemetry, security logs, service improvement, aggregated analytics and legal claims can
change the disposition and must be reviewed separately.

Employee consent is not selected as a blanket v1 basis. The dependency relationship identified in
BDSG § 26 makes voluntariness context-specific. Customer/employer legal basis, works-council or
employee-representation participation and any collective agreement remain customer/legal duties
that TapTim.e must support transparently.

## 4. Repository-derived data inventory

| Data class | Examples represented by current Product | Data subjects | Normal Product access | Current lifecycle truth |
|---|---|---|---|---|
| Organization/account | Organization ID, display/configuration data | customer administrators/contact persons | current Organization members by role | numeric legal retention not approved |
| Identity/authentication | provider issuer/subject binding, email/password handled by Auth provider, User, Membership, role, grant/revoke state | administrators, employees | identity and exact current Membership boundaries | invitation secrets are volatile; account retention undecided |
| Customer/work target | Customer, Project, General Work names/status | customer contacts may be identifiable; employees through assignment | administrators create/manage; employees receive bounded target projection | numeric retention/erasure behavior undecided |
| NFC setup | safe Tag name/fingerprint, Tag/Assignment history, validity timestamps | employees indirectly through use/assignment | protected Admin setup; safe Employee projection | raw NFC payload excluded from normal UI/evidence; retention undecided |
| Work/lifecycle evidence | WorkEvent, device occurrence/server receipt time, trigger provenance, canonical Decision, receipt | employees | own bounded Mobile view; administrators through bounded operational views | append-only during valid purpose; expiry policy legally open |
| Time records | active/stopped TimeEntry, effective correction/recovery values | employees | self-only Mobile; Organization Admin review/export | duration derived; numeric retention/expiry legally open |
| Correction/review | revision values, reason, actor, adjudication and review state | employees and administrator actors | protected Administrator capability; privileged details omitted from employee view | free-form reason can create excess/sensitive-data risk |
| Offline/device | installation binding, lease, queue/cursor/reconciliation and protected-state metadata | employees/device users | private encrypted device state and isolated backend capability | Android backup/transfer excluded; server retention undecided |
| Administration/audit | bootstrap/setup/invitation/project/time-review command receipts and AuditEvents | administrators/employees depending on action | restricted operator/Admin evidence | append-only purpose but no legal expiry schedule |
| Export | bounded effective CSV and content hash/audit | employees contained in selected Organization/range | current Administrator only | exported file leaves platform control; customer handling required |
| Operations/security | request/operation IDs, safe outcome/error class, authentication/security events | users/admins | restricted operators | production schema, recipients and retention not yet implemented |
| Backup/recovery | encrypted copies and post-backup lifecycle replay | all Product data subjects | restricted recovery operators | no production backup chain; RPO/RTO/retention undecided |
| Website/contact | IP/server logs, contact request, business contact details, consent state if optional storage exists | visitors/prospects | restricted business/support operators | DA8 not implemented; exact vendors/purposes undecided |

No special-category data is an intended Product field. Free-form names/reasons and support content
must nevertheless be treated as capable of containing unexpected sensitive or excessive data.

## 5. Required legal/privacy work products

### 5.1 Data inventory and processing records

Prepare a versioned register with:

- purpose, data subjects, fields/categories and source;
- controller/processor role;
- legal-basis candidate and required customer instruction;
- recipients/subprocessors and countries/regions;
- access roles and TOM references;
- retention trigger, numeric period and expiry action;
- data-subject request behavior;
- backup/export/log/replica propagation; and
- owner, approval date and review trigger.

### 5.2 Privacy notices

Separate modules are required instead of one ambiguous notice:

1. public website/contact notice;
2. customer administrator/business-contact notice;
3. employee/end-user Product information supporting the customer's Article 13/14 duties; and
4. security/support processing notice where TapTim.e acts for its own purposes.

Each module needs the exact legal entity, contact/representative, DPO if applicable, purposes,
legal bases, recipients, third-country safeguards, retention criteria, rights, complaint authority,
source and automated-decision truth. TapTim.e's Business Engine must not be described as Article
22 automated decision-making without legal analysis of purpose and legal/significant effect.

### 5.3 AVV/DPA under Article 28

The customer contract package must cover:

- subject, duration, nature, purpose, data/categories and data subjects;
- documented instructions and confidentiality;
- TOMs and security-incident cooperation;
- subprocessor approval/change/objection process;
- international transfers and safeguards;
- assistance with rights, DPIA and regulator consultation;
- deletion/return and backup expiry after termination;
- audit/information rights with proportionate confidentiality/security controls; and
- liability hierarchy aligned with the main B2B agreement.

### 5.4 TOMs

The initial TOM schedule should map evidence to:

- IAM/MFA/least privilege and privileged-operation separation;
- encryption in transit/at rest and key management;
- tenant/RLS/transaction isolation;
- Mobile SecureStore/SQLCipher and backup-transfer exclusion;
- secure development, CI, dependency/provenance and release controls;
- disclosure-safe logs, monitoring and access review;
- backup, restore, deletion/restriction replay and continuity;
- incident/breach detection, response and notification support;
- physical/provider controls through verified subprocessor evidence; and
- periodic review, testing and change management.

Unimplemented DA6 controls must be marked planned, never described as operating.

### 5.5 B2B AGB / SaaS agreement structure

Before drafting clauses, the Human Architect must confirm B2B-only v1. The external legal draft
should then address:

1. provider/customer identity and scope;
2. contract formation and precedence among order form, main agreement, AVV, TOMs and SLA;
3. service description and explicit Product exclusions;
4. customer setup, account, user and works-council/legal-basis responsibilities;
5. availability, maintenance and support only at approved numeric levels;
6. fees, taxes, term, renewal and termination;
7. acceptable use and prohibited surveillance/misuse;
8. customer data, instructions, export and return/deletion;
9. confidentiality, IP and feedback;
10. warranty/remedy and legally reviewed liability limits;
11. security incidents, force majeure and provider changes;
12. subprocessor/change notification;
13. suspension and extraordinary termination safeguards;
14. contract amendments and notice channels;
15. governing law, venue and severability; and
16. no consumer clauses unless a separate B2C decision and review exist.

No liability cap, warranty exclusion, unilateral-change clause, automatic renewal or venue clause
is approved by this package.

### 5.6 Website/legal pages

DA8 must not publish until it has:

- an exact DDG § 5 provider-information/Impressum record;
- the applicable privacy notice;
- a TDDDG § 25 assessment of every browser/device storage or access operation;
- consent management only if non-essential operations actually require it;
- no analytics/advertising/social embeds by default; and
- version/date/contact information plus accessible permanent links.

### 5.7 Employment and worker-representation handover

Customer onboarding material must explicitly require the customer to assess:

- lawful employment-purpose processing and transparency;
- data minimization and access by supervisors/administrators;
- working-time and payroll/evidence interactions;
- works-council/employee-representation participation, especially technical monitoring potential;
- collective agreement or policy needs;
- correction/dispute procedures; and
- prohibition of covert or unrelated performance monitoring.

TapTim.e does not decide a customer's employment-law basis.

## 6. External review package

The first counsel handover should contain:

- Product Vision and accepted v1 Product/role boundaries;
- current architecture and data-flow diagram;
- the completed data inventory above;
- proposed controller/processor matrix;
- proposed retention/expiry matrix with all undecided values visible;
- subprocessor/provider shortlist and regions once selected;
- DA6 TOM/control map with implemented/planned evidence;
- draft B2B commercial model and service description;
- proposed privacy-notice modules and AVV/AGB outlines;
- employee/works-council risk questions; and
- explicit list of production gates that remain closed.

## 7. Human decisions required now

The following are blocking inputs for publishable documents:

1. legal entity/form, registered/business address and authorized representative;
2. business contact, privacy contact and whether a DPO is appointed/required;
3. B2B-only v1 or any consumer access;
4. countries/markets and contract language;
5. commercial contracting model, price/billing, term and support channel;
6. Product service commitment and explicit exclusions;
7. intended controller/processor split and any TapTim.e secondary purposes;
8. production providers, subprocessors, regions and transfer mechanisms;
9. numeric data-class retention and expiry proposals for counsel;
10. support access model and customer authorization ceremony;
11. incident/breach contacts and responsibilities; and
12. external counsel selection and review budget.

Until these are answered and externally reviewed, every resulting legal text remains an internal
draft and production/pilot personal data remains unauthorized.

## 8. Immediate safe next step

After Human acceptance of this starter boundary:

1. complete the company/commercial decision sheet;
2. turn the inventory into a field-level processing register from the final production design;
3. prepare clearly placeholder-marked privacy/AVV/TOM/AGB drafts;
4. select providers only under separate cost/provisioning authority;
5. obtain qualified German/EU employment/privacy/commercial counsel review; and
6. implement accepted legal/technical corrections before any pilot data or publication.
