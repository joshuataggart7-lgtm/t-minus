# Sample requester package — A-2027-0101 (synthetic)

Fictional. Every name, code, rate, and fund cite is made up for testing T-Minus. Nothing here is a NASA record.

## What's in the zip

| File | What it is | What T-Minus should pull from it |
|---|---|---|
| 01_PR_4200SAMPLE0101.docx | Requester's cover memo / purchase request | Title, requisition number, requester, requesting org, directorate/program, need date, value, PoP, place, NAICS/PSC suggestion, GFP, the sole-source hint |
| 02_NF1707_Requester_Sections.docx | NF 1707 with the requester sections answered | All six gate answers and every section answer below |
| 03_SOW_Arctic_Snow_Depth_Flights.docx | Statement of Work | Scope, tasks, deliverables (D1–D5), GFP, aviation safety, RF, PoP, place |
| 04_IGCE_Arctic_Snow_Depth_Flights.xlsx | Independent Government Cost Estimate | Ten CLINs, unit prices, basis of estimate, total |

To test the "IGCE missing" path, upload only files 01–03.

## What a correct extraction looks like

Title: Commercial Aviation Services: Arctic snow depth flights, spring 2027 campaign
Requisition: 4200SAMPLE0101
Requester: Dr. Dana Kowalczyk (fictional), Code SGE
Directorate / program: SMD — Arctic Snow Depth Campaign 2027
Mission need date: 6 April 2027
Estimated value: $1,450,000
Period of performance: 1 March 2027 – 30 May 2027
Place of performance: Fairbanks International Airport, Fairbanks, AK
NAICS (requester suggestion): 481219 — the app should propose this or 481211 with a rationale and alternates; check the SAM size standard
PSC: V1A1
Contract type indication: FFP
Commercial indication: yes (commercial aviation services)
Sole-source language: yes — PR section 3 (STC on the incumbent's airframe; 4–6 months and $180–250K to re-integrate; cannot meet need date)

Gates: Services YES · IT NO · Hardware YES (GFP radar, Section 8) · Space flight NO · Aviation YES · Hazards YES (RF emitters)

1707 answers to check against the sections:
- S1: not available through strategic sourcing, documentation attached
- S2: no IT
- S3: GPC searched, none apply; NEPA excluded-activities list
- S4: services; not personal; not inherently governmental; not performed by civil servants
- S5.II: no SCaN; RF yes, Spectrum Manager authorization
- S5.III: no EVMS
- S5.V: manned aircraft YES, NPR 7900.3 review
- S5.VII: SCV DRD not required, below $20M
- S6: commercial under 8735.2C 5.1; neither critical nor complex; no higher-level QA
- S7: RF/microwave emitters; SMA involvement, public aircraft with external payload
- S8: GFP yes; no capital equipment
- S9: ASO flight request approval on file
- S10, S11: none
- S12: fee limitation N/A (FFP)

IGCE total: $1,450,000. CLIN 0001 is 160 hours at $3,600. If the app parses CLINs, it should get ten rows and the same total.

## Red flags the scan should raise

- Enterprise strategy A-102.7 Aircraft: mandatory vehicles at AFRC and JSC. The CO has to make and record a determination.
- Sole-source language in the PR: the roadmap should offer the JOFOC path, not assume it.
- With files 01–03 only: IGCE not attached.
