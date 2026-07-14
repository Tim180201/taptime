# ADR-0009: Android NFC UID Payload for v1

Status: Approved
Date: 2026-07-14
Approval Date: 2026-07-14
Roadmap: Core Roadmap v2, Block D (DT-053/DT-054)
Owner: Technical Lead
Approval Authority: Human Architect
Related Artifacts: ADR-0002, ADR-0003, ADR-0008, FB-001, TS-001,
`ADO/01_Architecture/NFC_Capability_Model.md`,
`ADO/02_Development/Block_D_NFC_Runtime_Physical_Validation_Authorization.md`

## Context

The B3 schema deliberately stores an opaque, case-sensitive NFC payload and provisionally enforces
Organization-scoped uniqueness. C2 deliberately transports that value without normalization. Before
the product scan path can be activated, Block D must choose UID versus NDEF, define one scan and
registration representation, and state what security claim that representation does and does not
make.

The installed Android adapter obtains `Tag.getId()` through `react-native-nfc-manager` and converts
the returned bytes to uppercase hexadecimal. Android documents that this identifier is a low-level
anti-collision/identification value: most tags have a stable UID, but some return a random identifier
on every discovery and some return no identifier. Its size and format are technology-specific.

## Decision

### 1. V1 source and platform

TapTim.e v1 uses the Android-discovered NFC tag UID as its technical tag locator. It does not read,
write or fall back to an NDEF business payload. Android is the only product NFC platform authorized
in Block D. iOS and Web must report a truthful unsupported state and must not attempt capture.

A tag with no UID, a changing/random identifier, or an identifier that fails the canonical codec is
unsupported for the v1 pilot. Physical validation must prove identifier stability for every pilot tag
type before NFC readiness is claimed.

### 2. Canonical payload codec

The only accepted stored and transported representation is:

```text
nfc:uid:v1:<HEX>
```

`<HEX>` is an even-length sequence of 2–64 ASCII hexadecimal characters (1–32 bytes), canonicalized
to uppercase. The pure shared codec may accept lowercase hexadecimal input only to canonicalize it.
It must reject whitespace, separators, prefixes such as `0x`, non-ASCII lookalikes, odd-length input,
empty input and out-of-bound input. It must never silently trim or remove characters.

The hardware scan path and every future tag-registration path must call the same shared codec. Raw
UIDs and alternative encodings must not be used as a fallback. Existing synthetic or operator-seeded
records used with the real path must be provisioned in canonical form. This decision changes no
existing migration and does not rewrite historical prototype fixtures automatically.

### 3. Meaning and authority

The canonical UID payload is only an Organization-scoped lookup key. It is not:

- a secret;
- proof that a particular physical tag is genuine;
- proof of user presence, location or entitlement;
- a business target, Customer identifier or lifecycle instruction;
- sufficient authorization for any read or write.

UIDs may be copied, emulated, collide across vendors or be unstable on unsuitable tags. TapTim.e
therefore keeps the payload free of business or personal data and relies on the authenticated current
Membership, tenant-scoped server resolution, active Assignment and the unchanged server Business
Engine for all authority and lifecycle decisions. Organization-scoped uniqueness remains the B3 v1
database rule; the same UID may exist in another Organization without granting cross-tenant access.

### 4. Operational rule

Pilot procurement must use UID-bearing tags whose repeated reads are stable on the supported Android
device set. Provisioning records the canonical payload through an audited operator process until the
Block E administration flow exists. Evidence may record a cryptographic fingerprint or redacted
identifier, but must not publish a raw UID unnecessarily.

## Alternatives considered

### NDEF application token

An application-generated NDEF token could be platform-neutral and independent of vendor UID format,
but it requires a governed write/lock/provisioning workflow that Block D does not authorize. A
writable NDEF value is still copyable and is not authentication. Adding it as a fallback would also
create two identities for one tag and ambiguous downgrade behavior. It is therefore not selected for
v1.

### Raw or normalized-without-namespace UID

A bare hexadecimal value is smaller, but cannot safely distinguish a future NDEF or other identifier
scheme. The versioned namespace makes storage and migration intent explicit.

## Consequences

Positive:

- blank or read-only UID-bearing tags can be used without an in-app writer;
- scan and future registration have one deterministic representation;
- case and separator drift cannot create accidental duplicate identities;
- future payload schemes can coexist only through an explicit new version/namespace decision.

Negative:

- v1 NFC is Android-only;
- random-ID/no-ID tags are unusable;
- UID cloning and cross-device byte-order assumptions remain operational/security limitations;
- supported tag types and devices must be physically qualified.

## Review triggers

Review this ADR before enabling iOS, introducing NDEF or cryptographic tags, accepting another UID
length/encoding, using NFC as anti-fraud evidence, or onboarding a tag/device type whose repeated UID
stability has not been proven.

## Primary implementation evidence

- Android `Tag.getId()` reference:
  `https://developer.android.com/reference/android/nfc/Tag#getId()`
- Installed adapter conversion:
  `node_modules/react-native-nfc-manager/android/src/main/java/community/revteltech/nfc/Util.java`
