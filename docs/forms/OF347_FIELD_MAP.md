# OF 347 (REV. 2/2012) — clustered XFA field map for T-Minus fill
**Form:** Order for Supplies or Services · blank `OF347-12c1.pdf` → `public/forms/OF347.pdf`  
**XFA root:** `F[0].P1[0].…` (page 1) and `F[0].P2[0].…` (back — receiving/rejections)  
**Datasets paths:** `F.P1.…` / `F.P2.…` (strip `[0]` like other forms)  
**Cite note (FORMS_PACK_README only):** FAR 53.213(f) — **confirm RFO Part 53 if adopted**.  
**When to emit:** Simplified acquisition order / delivery order under a parent contract (IDIQ/order path). Not the Part 12 commercial SF1449 primary path; not Part 15 SF33 solicit.  
**Key count:** 337 — **do not dump raw**. Clusters below + repeating patterns.  
**Signatures:** NEVER auto-fill `SignatureField2` (P1 CO / P2 receiving).  
**Back page (P2):** receiving report + rejections — leave empty in solicit/order prototype unless a receiving workflow exists.

---

## Cluster A — Header (order identity)

| Block / face label | Representative XFA | T-Minus source | Required? | Fill rule | Blank/flag |
|---|---|---|---|---|---|
| PAGE / OF PAGES | `PAGE`, `OFPAGE`, `TOTALPAGES` | print pagination | Prefer | `1` / `2` typical | Honest |
| 1 DATE OF ORDER | `ORDERDATE` | order date / `award_date` | Prefer | Date | Flag on order emit if blank |
| 2 CONTRACT NUMBER (If any) | `CONTRACTNO` | parent `contract_number` | Prefer on DO | Parent IDIQ/contract | Flag if delivery-order and blank |
| 3 ORDER NUMBER | `ORDERNO` | `order_number` | Prefer | — | Gap: assigned in NCMS |
| 4 REQUISITION/REFERENCE NUMBER | `REQUISITION` | `pr_number` / `acquisition_id` | Prefer | — | Flag if blank |
| 5 ISSUING OFFICE | `ISSUEADDRESS` | center + branch (+ address if recorded) | Prefer | Text block | Flag |

## Cluster B — Ship to (Block 6)

| Block / face label | Representative XFA | T-Minus source | Required? | Fill rule | Blank/flag |
|---|---|---|---|---|---|
| 6a NAME OF CONSIGNEE | `CONSIGNEENAME` | ship-to / POP contact or place name | Prefer | — | Flag if blank |
| 6b STREET ADDRESS | `STREETADDRESS` | ship-to street | Prefer | — | Flag |
| 6c CITY | `CITY[1]` | ship-to city | Prefer | Note: second `CITY` instance | Flag |
| 6d STATE | `STATE2` | ship-to state | Prefer | — | Flag |
| 6e ZIP CODE | `ZIPCODE2` | ship-to ZIP | Prefer | — | Flag |
| 6f SHIP VIA | `SHIPVIA` | shipping method if recorded | No | — | Blank OK |

## Cluster C — Contractor (Block 7)

| Block / face label | Representative XFA | T-Minus source | Required? | Fill rule | Blank/flag |
|---|---|---|---|---|---|
| 7a NAME OF CONTRACTOR | `CONTRACTNAME` | awardee / intended awardee | Prefer | — | Flag |
| 7b COMPANY NAME | `COMPANYNAME` | DBA / company if distinct | No | — | Blank OK |
| 7c STREET | `STREET` | contractor street if recorded | Prefer | Do not invent address | Flag if name present, address missing |
| 7d CITY | `CITY` (first) | — | Prefer | — | Flag |
| 7e STATE | `STATE` | — | Prefer | — | Flag |
| 7f ZIP | `ZIPCODE` (first) | — | Prefer | — | Flag |

## Cluster D — Type of order (Block 8)

| Block / face label | Representative XFA | T-Minus source | Required? | Fill rule | Blank/flag |
|---|---|---|---|---|---|
| 8a PURCHASE | `PURCHASE` | standalone simplified purchase | Method | Check when purchase order (no parent) | — |
| 8b DELIVERY | `DELIVERY` | order under parent contract | Method | Check when delivery order | — |
| REFERENCE YOUR | `REF` | parent solicitation/contract ref text | If 8b | Short ref | Flag if DO and blank |
| (related) | `REGUISIT` | requisition cross-ref if used | No | Note XFA spelling | Blank OK |

## Cluster E — Accounting / requisitioning / FOB / dates (Blocks 9–16)

| Block / face label | Representative XFA | T-Minus source | Required? | Fill rule | Blank/flag |
|---|---|---|---|---|---|
| 9 ACCOUNTING AND APPROPRIATION DATA | `ACCOUNT` | `funding_source` | Prefer | — | Flag if funded |
| 10 REQUISITIONING OFFICE | `REGUISIT` / dedicated if bound | requesting office / mission | No | Confirm which key binds to block 10 | Blank OK |
| 12 F.O.B. POINT | `FOB` | FOB terms | No | Text | Blank OK |
| 13a INSPECTION | `INSPECT` | inspection place if recorded | No | — | Blank OK |
| 13b ACCEPTANCE | `ACCEPT` | acceptance place | No | — | Blank OK |
| 14 GOVERNMENT B/L NUMBER | `GOVT` | B/L if any | No | — | Blank OK |
| 15 DELIVER TO F.O.B. POINT ON OR BEFORE | `DELIVERDATE` | need / delivery date | Prefer | Date | Flag if order needs date |
| 16 DISCOUNT TERMS | `DISCOUNT` | prompt pay if any | No | — | Blank OK |

## Cluster F — Business classification checkboxes (Block 11)

Face labels (from PDF layout):  
a SMALL · b OTHER THAN SMALL · c DISADVANTAGED · d WOMEN-OWNED · e HUBZone · f SERVICE-DISABLED VETERAN-OWNED · g WOSB · h EDWOSB

| Face | Likely XFA key(s) | Fill rule |
|---|---|---|
| a SMALL | `SMALL` | From SAM / set-aside / awardee socio-economic **only if recorded** |
| b OTHER THAN SMALL | `OTHERTHAN` | Mutually exclusive with SMALL when known |
| c DISADVANTAGED | `DISADVANTAGE` / `DISADVANTAGE[1]` | Record-driven; confirm which instance is c vs h |
| d WOMEN-OWNED | `WOMEN` / `WOMEN[1]` | Confirm instance vs g WOSB on face |
| e HUBZone | `HUBZONE` | Record-driven |
| f SDVOSB | `SERVICE` | Record-driven |
| g WOSB / h EDWOSB | second `WOMEN` / `DISADVANTAGE` instances | **label TBD from face** if binding ambiguous — Dev verifies in Reader; do not guess both checked |

**Blank/flag:** If socio-economic unknown, leave all unchecked; do not invent. Optional gap: "Business classification not recorded on file."

## Cluster G — Schedule line items (Block 17) — repeating pattern

**Face columns:** (a) ITEM NUMBER · (b) SUPPLIES OR SERVICES · (c) QUANTITY ORDERED · (d) UNIT · (e) UNIT PRICE · (f) AMOUNT · (g) QUANTITY ACCEPTED  

**Row indices on form:** `1` … `13` (thirteen schedule rows on P1).

| Column | XFA pattern | T-Minus source | Fill rule |
|---|---|---|---|
| (a) | `ITEMNOn` | `acquisition_clins[n-1].clin_number` | Prefer schedule; else IGCE |
| (b) | `SUPPLIESn` | description | Required for filled rows |
| (c) | `QUANTITYn` | quantity if recorded | **Never invent** |
| (d) | `UNITn` | unit_of_issue | Blank if not recorded |
| (e) | `UNITPRICEn` | unit_price | Blank if not recorded |
| (f) | `AMOUNTn` | extended_price | Blank if not recorded |
| (g) | `QUANTACCEPTn` | receiving | **Leave empty** on order issue |

Special: row 1 uses `SUPPLIES1`, `ITEMNO1`, `QUANTITY1`, `UNIT1`, `UNITPRICE1`, `AMOUNT1`, `QUANTACCEPT1` (same pattern).

| Totals / shipping | XFA | Rule |
|---|---|---|
| 17(h) TOT (cont. pages) | `TOTALPAGES` related / continued total if bound | Leave honest |
| 17(i) GRAND TOTAL | `GRANDTOTAL` | Sum known amounts or award/order total; flag if blank |
| 18 SHIPPING POINT | `SHIPPING` | If recorded |
| 19 GROSS SHIPPING WEIGHT | `GROSS` | Usually empty at issue |
| 20 INVOICE NUMBER | `INVOICE` | Empty at issue |

**Overflow:** >13 CLINs → continuation sheet / packet schedule; do not invent OF348 fill in this stretch (OF348 later).

## Cluster H — Mail invoice to (Block 21) + CO signature (22–23)

| Block / face label | Representative XFA | T-Minus source | Required? | Fill rule | Blank/flag |
|---|---|---|---|---|---|
| 21a NAME | `NAME21A` | invoice office name / `payment_office` | Prefer | — | Flag |
| 21b STREET | `STREET21B` | invoice address | Prefer | — | Flag |
| 21c CITY | `CITY21C` | — | Prefer | — | Flag |
| 21d STATE | `STATE21D` | — | Prefer | — | Flag |
| 21e ZIP | `ZIPCODE[1]` | third ZIP instance | Prefer | Confirm binding | Flag |
| 22 UNITED STATES OF AMERICA BY (Signature) | `SignatureField2` (P1) | — | CO | **NEVER auto-fill** | Empty |
| 23 NAME (Typed) | `NAME3` | `co_name` | Prefer | Typed name | Flag if blank |
| TITLE | (printed on face; may be fixed draw) | — | — | "CONTRACTING/ORDERING OFFICER" is face text | — |

## Cluster I — Page 2 back (receiving / rejections) — prototype EMPTY

Leave entire P2 empty on order generation unless a receiving workflow lands later.

| Group | Pattern | Count | Rule |
|---|---|---|---|
| Receiving flags | `INSPECTED`, `ACCEPTED`, `RECEIVED`, `PARTIAL`, `FINAL` | — | Empty |
| Receiving meta | `DATERECEIVED`, `RECEIVEDAT`, `TITLE`, `Date3`, `NumericField1`, `PAYMENT`, `GROSS2` | — | Empty |
| Gov signature | `SignatureField2` (P2) | — | **NEVER auto-fill** |
| Rejections grid | `RITEMn`, `REJECTSUPPLIESn`, `RUNITn`, `QUANTREJECTn`, `REASONn` | ~35 rows (quirky numbering; includes unnumbered `REASON`/`QUANTREJECT`/`RUNIT`/`REJECTSUPPLIES`) | Empty |

---

## Implementation note for Dev
Mirror SF1449: one `buildOf347(ctx)` returning `GeneratedForm` sections by cluster; `xfaDatasets` already nests dotted paths. Register form key `of-347`, blank `/forms/OF347.pdf`, wire `/forms/$formKey/$acquisitionId` allow-list. Same blank/flag `gap` strings as SF1449.
