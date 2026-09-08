# IA Onboarding — Full Status Flow

Here's the end-to-end flow for onboarding an IA, and the statuses we need backend to persist at each step. Covers everything from Eligibility Matrix all the way to HO Maker final approval.

## The flow

```
   ┌──────────────────────────────┐
   │  1. Eligibility Matrix       │   GT scores the candidate IA
   │     (scoring, no approval)   │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │  2. IA Registration (L1)     │   GT submits → SDE decides
   │     In-Principle Approval    │
   └──────────────┬───────────────┘
                  ▼  (only after L1 approved)
   ┌──────────────────────────────┐
   │  3. Sustainability Matrix    │   GT scores sustainability
   │     (scoring, no approval)   │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │  4. Detailed Appraisal (L2)  │   GT submits →
   │                              │   Cluster Expert comments →
   │                              │   SDE decides
   └──────────────┬───────────────┘
                  ▼  (only after L2 approved)
   ┌──────────────────────────────┐
   │  5. HO Maker Final (L3)      │   HO Maker final decision
   └──────────────────────────────┘
```

---

## 1. Eligibility Matrix

**Who:** GT only.
**Approval:** none — scoring form.

No status needed. It's a self-service scoring step that runs before the IA gets submitted for L1.

---

## 2. IA Registration — L1 In-Principle

**Who acts:** GT (submits, revises), SDE (approves / rejects / requests changes).

**Status enum on `IndustryAssociationRegistration`:**

| Status | Set by | When |
|---|---|---|
| `SUBMITTED` | Backend on POST | GT submits the In-Principle form |
| `L1_APPROVED` | SDE | SDE approves on the review page |
| `L1_REJECTED` | SDE | SDE rejects |
| `L1_CHANGES_REQUESTED` | SDE | SDE asks GT to revise |
| `L1_RESUBMITTED` | Backend on PUT after rejection/changes | GT edits and saves again |

**Decision-trail columns:**

```
status                : VARCHAR (enum above)
l1DecisionAt          : TIMESTAMP
l1DecisionByUsername  : VARCHAR
l1DecisionReason      : TEXT       -- mandatory on REJECTED / CHANGES_REQUESTED
```

**Endpoint:**

```
PATCH /industry-association-registrations/{uuid}/l1-decision
Body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES", reason?: string }
```

---

## 3. Sustainability Matrix

**Who:** GT only.
**Approval:** none — scoring form. Gates the Detailed Appraisal.

No status needed. It's a self-service scoring step between L1 approval and the L2 Detailed Appraisal.

---

## 4. Detailed Appraisal — L2

**Who acts:** GT (submits, revises), Cluster Expert (comments + approve / reject / request changes), SDE (approves / rejects / requests changes).

**Status enum on `IndustryAssociationAppraisal`:**

| Status | Set by | When |
|---|---|---|
| `GT_SUBMITTED` | Backend on POST | GT files the detailed appraisal |
| `CLUSTER_EXPERT_REVIEW` | Backend | Ready for CE review |
| `CE_APPROVED` | Cluster Expert | CE approves along with comments — advances to SDE |
| `CE_REJECTED` | Cluster Expert | CE rejects with reason |
| `CE_CHANGES_REQUESTED` | Cluster Expert | CE asks GT to revise |
| `SDE_REVIEW` | Backend on `CE_APPROVED` | Ready for SDE review |
| `L2_APPROVED` | SDE | SDE approves — advances to HO Maker |
| `L2_REJECTED` | SDE | SDE rejects |
| `L2_CHANGES_REQUESTED` | SDE | SDE asks GT to revise |
| `L2_RESUBMITTED` | Backend on PUT after any rejection/changes (CE or SDE) | GT edits and saves again |

**Decision-trail columns:**

```
status                          : VARCHAR (enum above)

-- Cluster Expert
clusterExpertDecision            : VARCHAR (APPROVED | REJECTED | CHANGES_REQUESTED)
clusterExpertDecisionAt          : TIMESTAMP
clusterExpertDecisionByUsername  : VARCHAR
clusterExpertDecisionReason      : TEXT       -- mandatory on REJECTED / CHANGES_REQUESTED
clusterExpertTermsComments       : TEXT       -- dedicated column (currently packed into clusterExpertComments)

-- SDE L2
l2DecisionAt                     : TIMESTAMP
l2DecisionByUsername             : VARCHAR
l2DecisionReason                 : TEXT       -- mandatory on REJECTED / CHANGES_REQUESTED
```

**Endpoints:**

```
PATCH /industry-association-appraisals/{uuid}/cluster-expert-decision
Body: {
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  generalComments: string,
  termsComments: string,
  reason?: string        // required on REJECT / REQUEST_CHANGES
}

PATCH /industry-association-appraisals/{uuid}/l2-decision
Body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES", reason?: string }
```

---

## 5. HO Maker Final — L3

**Who acts:** HO Maker.

**Kicks in after L2_APPROVED.** HO Maker gives the final Approve / Reject with mandatory remarks.

**Status enum (adds to the L2 status on the same appraisal record):**

| Status | Set by | When |
|---|---|---|
| `HO_APPROVED` | HO Maker | HO approves — proposal complete |
| `HO_REJECTED` | HO Maker | HO rejects |

**Decision-trail columns:**

```
hoDecision            : VARCHAR (APPROVED | REJECTED)
hoDecisionAt          : TIMESTAMP
hoDecisionByUsername  : VARCHAR
hoDecisionRemarks     : TEXT       -- mandatory on both APPROVE and REJECT
```

Right now the HO Maker decision is packed into `recommendationRemarks` behind a delimiter — please give it dedicated columns as above.

**Endpoint:**

```
PATCH /industry-association-appraisals/{uuid}/ho-decision
Body: { decision: "APPROVE" | "REJECT", remarks: string }
```

---

## Full status journey (one IA, happy path)

```
Eligibility Matrix scored
        ↓
SUBMITTED  →  L1_APPROVED
        ↓
Sustainability Matrix scored
        ↓
GT_SUBMITTED  →  CLUSTER_EXPERT_REVIEW  →  CE_APPROVED  →  SDE_REVIEW  →  L2_APPROVED
        ↓
HO_APPROVED    (done)
```

## Rejection / changes paths

- At **L1**: SDE REJECTS or REQUESTS_CHANGES → back to GT → GT edits and saves → `L1_RESUBMITTED` → re-enters SDE queue.
- At **L2 (CE stage)**: CE REJECTS or REQUESTS_CHANGES → back to GT → GT edits and saves → `L2_RESUBMITTED` → re-enters CE queue.
- At **L2 (SDE stage)**: SDE REJECTS or REQUESTS_CHANGES → back to GT → GT edits and saves → `L2_RESUBMITTED` → re-enters CE queue (CE decides whether to re-approve or send to SDE again).
