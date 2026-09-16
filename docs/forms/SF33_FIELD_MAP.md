# SF 33 (REV. 12/2022) — XFA field map for T-Minus fill
**Form:** Solicitation, Offer, and Award · blank `SF33-22.pdf` → ship as `public/forms/SF33.pdf`  
**XFA root:** `topmostSubform[0].Page1[0].…` (omit `[0]` in datasets paths like live SF1449/SF30)  
**Cite note (FORMS_PACK_README only):** FAR 53.214(c) — **confirm RFO Part 53 if adopted**. Do not invent further cites.  
**Architecture:** same as SF1449/SF30 — `buildSf33(ctx)` → sections/fields → `xfaDatasets` → `exportXfaIncremental` / `exportXdp`.  
**Signatures:** NEVER auto-fill `SignatureField1[0]` / `SignatureField1[1]`. Leave empty.  
**Offeror blocks 12–18:** leave empty in prototype (contractor completes).  
**CLINs:** SF33 face has no line-item grid; schedule lives in UCF Section B / continuation. Prefer `acquisition_clins` (else `igce_clins`); do not invent qty.

Prefix every path below with `topmostSubform.Page1.` when writing datasets (mirror `sf-forms.ts`).

---

## Header / DPAS / pages

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 1 / DPAS rating | `RATING` | `acquisition_facts.dpas_rating` | No | Copy if present | Leave blank if none |
| Page | `PG1` | constant | Yes (print) | `"1"` | — |
| Of pages | `PG2` | packet page count or `"1"` | Prefer | Honest count when known | Flag if unknown and multi-page packet |

## Blocks 2–8 — solicit identity / issuing office

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 2 CONTRACT NUMBER | `CONTRACTNUM` | `contract_number` | Award path Yes | Fill at award; solicit may be empty | Gap: "Assigned in NCMS at award." |
| 3 SOLICITATION NUMBER | `SOLICITATION` | `solicitation_number` | Solicit Yes | Copy | Gap: "Assigned in NCMS when solicitation issues." |
| 4 TYPE — SEALED BID (IFB) | `SEALED` | `acquisition_method` / solicitation type | Method | Check when sealed-bid / IFB path | Leave unchecked if negotiated |
| 4 TYPE — NEGOTIATED (RFP) | `NEGOTIATED` | same | Method | Check when RFP / Part 15 negotiated | Mutual exclusive with SEALED |
| 5 DATE ISSUED | `DateISSUED` | `solicitation_date` | Solicit prefer | ISO → form date | Flag if solicit issued and blank |
| 6 REQUISITION/PURCHASE NUMBER | `REQUNUM` | `pr_number` else `acquisition_id` | Prefer | PR first | Flag if both empty |
| 7 ISSUED BY | `ISSUEDBY` | `center_name`/`center_code` + `branch_code` | Prefer | Join like SF1449 `issuedBy` | Flag: CO to complete issuing office |
| 7 CODE | `ISSUECODE` | org / DoDAAC-style office code if on record | No | Copy only if recorded | Leave blank — do not invent |
| 8 ADDRESS OFFER TO | `FOFFERTOADDY` | offer-to address if distinct; else same as 7 / CO mail | Prefer | Text block | Flag if solicit live and blank |

## Block 9 — sealed offer receipt (government-side)

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 9 copies count | `SEALEDOFFERS` | Section L / response instructions if recorded | No | Numeric copies | Leave blank if not recorded |
| 9 depository located in | `LOCATEDIN` | Section L place of receipt | Prefer on IFB | Text | Flag on sealed-bid if blank |
| 9 until (hour) | `UNTIL` | response time from record / L | Prefer | Local time string | Flag if due date set and blank |
| 9 (Date) | `DEPOSITORYDATE` | offer due date | Prefer | Date | Flag if solicit live and blank |

## Block 10 — for information call

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 10A NAME | `NAME10A` | `co_name` | Prefer | CO POC | Flag if blank |
| 10B AREA CODE | `AREACODE1` | parse `co_phone` | No | Digits only | Leave blank if no phone |
| 10B NUMBER | `NUMBER1` | parse `co_phone` | No | — | — |
| 10B EXTENSION | `EXT1` | parse `co_phone` | No | — | — |
| 10C EMAIL ADDRESS | `EMAIL` | `co_email` if present | No | Copy | Leave blank if not on record |

## Block 11 — Table of Contents (UCF X + page(s))

Face: PART I A–H, PART II I, PART III J, PART IV K–M.  
X marks: `A11`…`H11`, `I11`, `J11`, `K11`, `L11`, `M11`.  
Page(s): `PG11A`…`PG11H`, `PG11I`, `PG11J`, `PG11K`, `PG11L`, `PG11M`.

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 11 (X) Section A–M | `A11`…`M11` | UCF scaffold presence / packet sections | Prefer | `1`/`0` when section present in packet | Unchecked = section not in this package |
| 11 PAGE(S) A–M | `PG11A`…`PG11M` | packet page refs if known | No | Page number or range string | Leave blank if unknown — do not invent |

## Blocks 12–18 — OFFER (offeror) — prototype EMPTY

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 12 acceptance calendar days | `CALDAYS` | — | Offeror | **Leave empty** | — |
| 13 discount 10/20/30 / other days & % | `CALANDAR10`, `CALANDAR20`, `CALENDAR30`, `CALENDAR`, `NUMBERFORCALENDAR` | — | Offeror | **Leave empty** | Note misspellings `CALANDAR*` are the real XFA keys |
| 14 amendment # / date ×4 | `AMEND1`–`AMEND4`, `AMENDDate1`–`AMENDDate4` | — | Offeror | **Leave empty** (offeror ack) | Government may later show issued amends in packet text, not here |
| 15A NAME AND ADDRESS OF OFFEROR | `OFFERORADDY` | — | Offeror | **Leave empty** | Do not prefill awardee on solicit |
| 15A CODE | `CODE15A` | — | Offeror | **Leave empty** | — |
| 15A FACILITY | `FACILITY` | — | Offeror | **Leave empty** | — |
| 15B AREA / NUMBER / EXT | `AREA2`, `NuMBER2`, `EXT2` | — | Offeror | **Leave empty** | Note capital `B` in `NuMBER2` |
| 15C remittance different | `CHECK15C` | — | Offeror | **Leave empty / unchecked** | — |
| 16 NAME AND TITLE AUTHORIZED TO SIGN | `TITLEAUTHORIZED` | — | Offeror | **Leave empty** | — |
| 17 SIGNATURE | `SignatureField1[0]` (path index) | — | Offeror | **NEVER auto-fill** | Empty |
| 18 OFFER DATE | `OFFERDate` | — | Offeror | **Leave empty** | — |

## Blocks 19–28 — AWARD (Government)

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 19 ACCEPTED AS TO ITEMS NUMBERED | `ACCITEM` | accepted CLIN numbers from `acquisition_clins` | Award prefer | e.g. `0001-0003` or list | Flag if award path and blank |
| 20 AMOUNT | `LIABILITY1` / `LIABILITY1[1]` | sum extended prices if known; else `award_amount` / `proposed_price` | Award prefer | Currency string; do not invent | Flag if award and blank; two XFA instances — fill primary only unless both bind |
| 21 ACCOUNTING AND APPROPRIATION | `APPROPRIATION` | `funding_source` | Prefer | Text | Flag if funded award and blank |
| 22 authority 10 U.S.C. 3204(a) | `USC2304` | JOFOC / OTFAO path when DoD-style authority on record | Conditional | Check only if record cites this family | Unchecked if full & open / not applicable — **do not invent paren cite** |
| 22 authority 41 U.S.C. 3304(a) | `USC253` | civilian OTFAO when on record | Conditional | Check only if recorded | Unchecked otherwise |
| 23 SUBMIT INVOICES … ITEM | `INVOICEITEM` | invoice address / Section G item ref | No | Copy if recorded | Leave blank |
| 24 ADMINISTERED BY | `ADMINISTEREDBY` | admin office or same as issued-by | Prefer | Text | Flag if blank on award |
| 25 PAYMENT WILL BE MADE BY | (payment office text — see `PAYMENTCODE` / related) | `payment_office` | Prefer | Text into payment block fields present | Flag if blank on award |
| 25 CODE | `PAYMENTCODE` | payment office code if any | No | Copy only if recorded | — |
| 25 payment date (if used) | `PAYMENTDate` | — | No | Usually empty at award fill | Leave blank unless record has it |
| 26 NAME OF CONTRACTING OFFICER | `CONTRACTINGOFFICER` | `co_name` | Prefer | Type/print name only | Flag if blank |
| 27 UNITED STATES OF AMERICA (signature) | `SignatureField1[1]` | — | CO | **NEVER auto-fill** | Empty; gap: "CO signs in NCMS / wet ink" |
| 28 AWARD DATE | `AWARDDATE` | `award_date` | Award prefer | Fill when awarded on record | Leave blank pre-award; flag if claiming award |

### Unmapped / ambiguous SF33 keys
| XFA field | Notes |
|---|---|
| `LIABILITY1[1]` | Second instance of amount/liability — confirm binding on face before dual-fill |
| Payment block layout | Face shows "PAYMENT WILL BE MADE BY" + CODE; exact text field vs `PAYMENTCODE`/`PAYMENTDate` — verify in Reader after first fill |

