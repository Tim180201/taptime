# ABS-001 – Agent Bootstrap Standard

Status: Draft  
Document ID: ABS-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: AOF-001, AOS-001, ADS-001, AIR-001, RHS-001

## Purpose

ABS-001 defines the mandatory technical startup process for every Human or AI Agent in TapTim.e.

The Bootstrap verifies whether an agent can technically begin Agent Onboarding.

ABS-001 does not perform onboarding, repository discovery, repository health verification or role execution.

FDOS Rule:

> No agent may start onboarding before Agent Bootstrap has verified repository access and repository reading capability.

## Scope

ABS-001 applies before AOS-001.

It applies to every Human and AI Agent defined by the Engineering Operating Model and Agent Registry.

No role is exempt.

## Bootstrap Principle

Bootstrap answers only two questions:

1. Can the agent access the required repositories?
2. Can the agent obtain a complete repository inventory using the available execution environment?

If either answer is no, the agent must stop and report `STATUS: BLOCKED`.

FDOS Rule:

> Repository access is not equal to repository understanding.

## Bootstrap Sequence

```text
Agent Start
  -> Git Access Check
  -> Repository Capability Check
  -> Repository Inventory Check
  -> Bootstrap Result
  -> ADO/README.md
  -> AOS-001 Agent Onboarding
```

## Step 1 — Git Access Check

The agent verifies access to:

- `Tim180201/fdos-genesis`
- `Tim180201/taptime`

The agent confirms:

- repository availability
- read permission
- default branch
- current repository state access

If access is unavailable:

```text
STATUS: BLOCKED
Reason: Repository access unavailable.
Required Action: Provide GitHub connector access, local repository access or repository archive.
```

## Step 2 — Repository Capability Check

The agent verifies whether the available execution environment can obtain a complete repository inventory.

Allowed methods:

- GitHub repository tree or file inventory
- local clone
- uploaded repository archive
- complete repository manifest
- official ADO navigation entry point plus readable referenced documents

Not sufficient:

- README-only review
- web search
- individual known file paths without inventory
- assumptions from previous conversations

If the agent cannot obtain complete inventory:

```text
STATUS: BLOCKED
Reason: Complete repository inventory unavailable.
Required Action: Provide repository tree access, local clone, ZIP archive or Repository Manifest.
```

## Step 3 — Repository Inventory Check

The agent confirms that a complete file inventory exists or can be generated for both repositories.

Minimum required inventory scope:

- FDOS Genesis documentation and standards
- TapTim.e ADO
- TapTim.e architecture artifacts
- TapTim.e development artifacts
- TapTim.e evidence artifacts
- Decision Log
- ADRs
- EP-006 standards

## Step 4 — ADO Navigation Entry Point

After ABS-001 completes successfully, the agent shall read:

`ADO/README.md`

This file is the official TapTim.e ADO navigation entry point.

AOS-001 may begin only after `ADO/README.md` has been read.

FDOS Rule:

> Agent onboarding begins from the official ADO navigation entry point.

## Bootstrap Completion Criteria

ABS-001 is complete when:

- Git access is verified
- repository read permission is verified
- default branch is identified
- repository inventory capability is verified
- complete repository inventory is available or can be generated
- `ADO/README.md` is available as the ADO navigation entry point

Only then may the agent proceed to AOS-001.

## Blocking Conditions

The agent must block if:

- GitHub access is unavailable
- private repositories cannot be read
- repository inventory cannot be obtained
- `ADO/README.md` cannot be read
- only README or web search is available
- the agent cannot verify current repository state

## Bootstrap Result

ABS-001 produces one of two outcomes:

```text
BOOTSTRAP COMPLETE
Read ADO/README.md and proceed to AOS-001.
```

or

```text
STATUS: BLOCKED
Reason:
Required Action:
```

## Minimal Role Prompt Pattern

```text
You are the [ROLE NAME] for the TapTim.e project.

Repositories:
- FDOS Genesis: https://github.com/Tim180201/fdos-genesis
- TapTim.e: https://github.com/Tim180201/taptime

Before doing any work, run ABS-001 Agent Bootstrap Standard.

If ABS-001 cannot be completed, stop and report STATUS: BLOCKED.

If ABS-001 completes successfully, read ADO/README.md and continue with AOS-001.

After READY FOR WORK, execute your role according to:
- EOM-001 Engineering Operating Model
- AGR-001 Agent Registry

At the end of every task, produce:
- Engineering Package
- Role Handover
- Next Responsible Role
- Prompt for Next Role
```

## Relationship to AOS-001

ABS-001 is the technical precondition for AOS-001.

AOS-001 may only begin after ABS-001 completes successfully and `ADO/README.md` has been read.

ABS-001 does not replace AOS-001.
