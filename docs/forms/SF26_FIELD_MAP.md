# SF 26 (REV. 12/2022) — XFA field map for T-Minus fill
**Form:** Award/Contract · blank `SF26-22.pdf` → `public/forms/SF26.pdf`  
**XFA root:** `topmostSubform[0].Page1[0].…` → datasets paths `topmostSubform.Page1.…`  
**Cite note (FORMS_PACK_README only):** FAR 53.214(a) — **confirm RFO Part 53 if adopted**.  
**When to emit:** Award-only path when the file is **not** using the SF 33 award block (SF33 face note: award may be on SF33, SF26, or other written notice). Typical: Part 15 / noncommercial award after separate solicitation instrument, or CO chooses SF26 as award vehicle.  
**Signatures:** NEVER auto-fill `SignatureField1[0]` (contractor) or `SignatureField1[1]` (CO).  
**Contractor-signed blocks 19A–19C:** empty in prototype.  
**CLINs:** Blocks 15A–15F rows 1–5 from `acquisition_clins` (prefer) / `igce_clins`; do not invent qty/price.

---

## Header / DPAS / pages

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 1 DPAS rating | `RATING` | `dpas_rating` | No | Copy if present | Blank OK |
| Page | `PAGE1` | constant | Prefer | `"1"` | — |
| Of pages | `PG2OF2` | packet pages | Prefer | Honest count | `"1"` if single page |

## Blocks 2–6 — contract identity / offices

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 2 CONTRACT NUMBER | `CONTR2` | `contract_number` | Award Yes | NCMS-assigned | Gap: "Assigned in NCMS at award." |
| 3 EFFECTIVE DATE | `EFECTDATE3` | `award_date` / mod effective / POP start | Prefer | Date (note XFA spelling `EFECTDATE3`) | Flag if award claimed and blank |
| 4 REQUISITION/PURCHASE REQUEST/PROJECT NUMBER | `REQUISITION4` | `pr_number` else `acquisition_id` | Prefer | — | Flag if blank |
| 5 ISSUED BY | `ISSUED5` | center + branch | Prefer | Same join as SF1449 | Flag |
| 5 CODE | `CODE5` | office code if recorded | No | Do not invent | Blank OK |
| 6 ADMINISTERED BY | `ADMIN6` | admin office or issued-by | Prefer | Text | Flag if blank |
| 6 CODE | `CODE6` | admin code if recorded | No | — | Blank OK |

## Blocks 7–12 — contractor / delivery / payment

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 7 NAME AND ADDRESS OF CONTRACTOR | `NAMEADDY7` | `awardee_name` / `intended_awardee_name` + address if any | Award prefer | Name (+ address when recorded) | Flag: "No awardee on record; filled at award." |
| 7 CODE | `CODE7` | `awardee_uei` / `intended_awardee_uei` | Prefer | UEI | Flag if awardee named without UEI |
| 7 FACILITY CODE | `FACILITYCODE7` | facility code if recorded | No | Do not invent | Blank OK |
| 8 DELIVERY — FOB ORIGIN | `FOBORIGIN` | delivery terms if recorded | Conditional | Check when FOB origin | Else unchecked |
| 8 DELIVERY — OTHER | `OTHER` | delivery terms | Conditional | Check when other / destination / see schedule | — |
| 9 DISCOUNT FOR PROMPT PAYMENT | `DISCOUNT` | prompt-pay terms if recorded | No | Text/% | Blank OK |
| 10 SUBMIT INVOICES … ITEM | `INVOICE` | invoice address / item ref | Prefer | Text | Flag if blank on award |
| 11 SHIP TO/MARK FOR | `SHIP11` | place of performance / ship-to | Prefer | `place_of_performance_standardized` or POP | Flag if blank |
| 11 CODE | `CODE1` | ship-to code if any | No | — | Blank OK |
| 12 PAYMENT WILL BE MADE BY | (payment text — bind to payment fields present) | `payment_office` | Prefer | Text | Flag if blank |
| 12 CODE | `CODE2` | payment code if any | No | — | Blank OK |

## Blocks 13–14 — competition authority / accounting

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 13 10 U.S.C. 3204(a)( ) | `AUTHORITY10` + paren `USC10Paren` | JOFOC / authority on record | Conditional | Check + paren only if recorded | Do not invent paren digit |
| 13 41 U.S.C. 3304(a)( ) | `AUTHORITY41` + paren `USC3304aParen` | same | Conditional | Same rule | Unchecked if full & open |
| 14 ACCOUNTING AND APPROPRIATION DATA | `ACCOUNTING14` / `ACCOUNTING1` | `funding_source` | Prefer | Fill primary accounting field; confirm which of the two binds on face | Flag if funded award blank |

## Block 15 — schedule lines (rows 1–5) + total

Pattern per row `n` = 1..5:

| Face col | XFA pattern | Source |
|---|---|---|
| 15A ITEM NUMBER | `ITEMNOn` | `acquisition_clins[n-1].clin_number` |
| 15B SUPPLIES/SERVICES | `SUPPLIESSERVICESn` | description (+ POP note on row 1 if useful) |
| 15C QUANTITY | `C15n` | quantity **only if recorded** |
| 15D UNIT | `D15n` | `unit_of_issue` if recorded |
| 15E UNIT PRICE | `E15n` | unit_price if recorded |
| 15F AMOUNT | `F15n` | extended_price if recorded |

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 15 rows 1–5 | see pattern | `acquisition_clins` prefer; else `igce_clins` (mark estimate-sourced in packet, not invent) | Prefer ≥1 on award | Fill available rows; leave unused rows empty | Qty/unit/price blank → leave blank + flag "Not recorded" — **never invent** |
| 15G TOTAL AMOUNT OF CONTRACT | `F15TOTAL` | sum of known extended amounts or `award_amount` | Prefer | Currency | Flag if award and blank |
| Extra supplies line | `SUPPLIESSERVICES5` | continuation / 5th description if needed | No | Use when 5th CLIN | — |

## Block 16 — Table of Contents

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 16 (X) A–M | `G15A`…`G15M` | UCF sections present | Prefer | Checkbox 1/0 | — |
| 16 PAGE(S) A–M | `PAGESA`…`PAGESM` | page refs | No | Do not invent | Blank OK |

## Blocks 17–18 — award type checkboxes

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 17 CONTRACTOR'S NEGOTIATED AGREEMENT | `CONT17` | negotiated / Part 15 award | Method | Check when contractor must sign | — |
| 17 copies to return | `NUMCOPY` | copies if recorded | No | Number | Blank OK |
| 18 SEALED-BID AWARD | `AWARD18` | sealed-bid path | Method | Check only for sealed-bid award | Mutual exclusive with 17 intent |
| 18 Solicitation Number | `SOLMUN` | `solicitation_number` | If 18 | Fill when sealed-bid award | Flag if 18 checked and blank |

## Blocks 19–20 — signatures (contractor empty; CO name only)

| Block / face label | XFA field name | T-Minus source | Required? | Fill rule | Blank/flag behavior |
|---|---|---|---|---|---|
| 19A NAME AND TITLE OF SIGNER | `NAMETITLE` | — | Contractor | **Leave empty** | — |
| 19B NAME OF CONTRACTOR (signature) | `SignatureField1[0]` | — | Contractor | **NEVER auto-fill** | Empty |
| 19C DATE SIGNED | `DateSIGNED19C` | — | Contractor | **Leave empty** | — |
| 20A NAME OF CONTRACTING OFFICER | `NAMECONTRACTING` | `co_name` | Prefer | Type/print only | Flag if blank |
| 20B UNITED STATES OF AMERICA (signature) | `SignatureField1[1]` | — | CO | **NEVER auto-fill** | Empty |
| 20C DATE SIGNED | `DateSIGNED20` | — | CO | **Leave empty** (CO completes) | Do not stamp award_date into signature date unless product policy says so — default empty |

