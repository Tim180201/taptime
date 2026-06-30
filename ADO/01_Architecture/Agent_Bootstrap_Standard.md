# ABS-001 – Agent Bootstrap Standard

Status: Draft  
Document ID: ABS-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: AOF-001, AOS-001, ADS-001, AIR-001, RHS-001

## Purpose

ABS-001 defines the mandatory technical bootstrap process for every Human or AI Agent in TapTim.e.

The Bootstrap verifies whether an agent can technically begin Agent Onboarding.

ABS-001 does not perform onboarding, full ADS-001 repository discovery, repository health verification or role execution.

FDOS Rule:

> No agent may start onboarding before Agent Bootstrap has verified repository access and repository reading capability.

## Startup Preconditions

ABS-001 may begin only after:

1. GitHub Connector Verification has completed.
2. Initial Repository Discovery has located the official ADO navigation entry point using repository evidence.
3. `ADO/README.md` has been read.

FDOS Rule:

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

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
ADO/README.md Read
  -> Git Access Check
  -> Repository Capability Check
  -> Repository Inventory Check
  -> Bootstrap Result
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

## Step 4 — Bootstrap Completion

After ABS-001 completes successfully, the agent proceeds to AOS-001.

`ADO/README.md` has already been located and read before ABS-001 begins.

FDOS Rule:

> Agent onboarding begins only after repository evidence, ADO navigation and bootstrap have been completed.

## Bootstrap Completion Criteria

ABS-001 is complete when:

- GitHub Connector Verification was completed before ABS-001,
- the official ADO navigation entry point was located before ABS-001,
- `ADO/README.md` was read before ABS-001,
- Git access is verified,
- repository read permission is verified,
- default branch is identified,
- repository inventory capability is verified,
- complete repository inventory is available or can be generated.

Only then may the agent proceed to AOS-001.

## Blocking Conditions

The agent must block if:

- GitHub access is unavailable,
- private repositories cannot be read,
- repository inventory cannot be obtained,
- `ADO/README.md` cannot be read,
- only README or web search is available,
- the agent cannot verify current repository state,
- the agent cannot confirm that ADO navigation was located through repository evidence.

## Bootstrap Result

ABS-001 produces one of two outcomes:

```text
BOOTSTRAP COMPLETE
Proceed to AOS-001.
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

Before doing any work:

1. Verify GitHub Connector access.
2. Perform initial Repository Discovery.
3. Locate and read ADO/README.md using repository evidence.
4. Run ABS-001 Agent Bootstrap Standard.

If ABS-001 cannot be completed, stop and report STATUS: BLOCKED.

If ABS-001 completes successfully, continue with AOS-001.

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

AOS-001 may only begin after GitHub Connector Verification, initial Repository Discovery, ADO navigation, `ADO/README.md` reading and ABS-001 have completed successfully.

ABS-001 does not replace AOS-001.
