"""Build the UCA / Letter Contract Justification marker master.

Only word/document.xml is changed: the instruction pages and the Document
History Log are removed, the letter-contract justification body becomes
isolated markers, and the UCA-only branches (UCA purpose, UCA scope
statement, UCA government estimate, the contract-type NTE language, the
FAR 52.243-6 block and the UCA signature page) are removed on this path.
Letterhead, styles, relationships, footer version identifier and signature
underscores stay untouched. Signature ink is never filled in the master.
"""
import html
import os
import re
import shutil
import sys
import zipfile

WT = '<w:t xml:space="preserve">%s</w:t>'

# The justification face starts here; everything before it is instruction and
# the Document History Log.
BODY_START = 87


def esc(value):
    return html.escape(value, quote=False)


def para_rpr(paragraph):
    match = re.search(r'<w:pPr>.*?</w:pPr>', paragraph, re.S)
    ppr = match.group(0) if match else ''
    run_match = re.search(r'<w:r\b(?![a-zA-Z]).*?</w:r>', paragraph, re.S)
    rpr = ''
    if run_match:
        props = re.search(r'<w:rPr>.*?</w:rPr>', run_match.group(0), re.S)
        if props:
            rpr = props.group(0)
    for pattern in (
        r'<w:color[^/]*/>',
        r'<w:highlight[^/]*/>',
        r'<w:u\b[^/]*/>',
        r'<w:rStyle[^/]*/>',
        r'<w:i\b[^/]*/>',
    ):
        rpr = re.sub(pattern, '', rpr)
    ppr = re.sub(r'<w:color[^/]*/>|<w:highlight[^/]*/>|<w:u\b[^/]*/>', '', ppr)
    return ppr, rpr


def build_para(paragraph, text):
    ppr, rpr = para_rpr(paragraph)
    segments = [part for part in re.split(r'(\[\[[A-Z0-9_]+\]\])', text) if part]
    runs = ''.join('<w:r>%s%s</w:r>' % (rpr, WT % esc(part)) for part in segments)
    return '<w:p>%s%s</w:p>' % (ppr, runs)


SEC1 = '1. Purpose:'
SEC2 = '2. Background:'
SEC3 = '3. Statement of Impact/Urgency:'
SEC4 = '4. Description of Action:'
SEC5 = '5. Proposed Definitization Schedule'
SEC6 = '6. Determination'

EDITS = {
    87: '[[TITLE_LINE]]',
    88: '[[CENTER_NAME]]',
    90: SEC1,
    # UCA-only purpose branch removed on the letter-contract path.
    92: '', 93: '', 95: '', 97: '',
    98: '[[PURPOSE]]',
    100: '',
    102: '[[BEST_INTEREST]]',
    104: SEC2,
    106: '[[BACKGROUND]]',
    108: SEC3,
    110: '[[IMPACT]]',
    # UCA-only general-scope statement.
    112: '', 113: '',
    115: SEC4,
    117: 'Contractor name and address:',
    118: '[[CONTRACTOR]]',
    120: 'Place of performance:',
    121: '[[PLACE]]',
    123: 'Contract or order number, if applicable:',
    124: '[[INSTRUMENT_NO]]',
    126: 'Performance period or delivery schedule for both the letter contract and the definitized contract:',
    127: '[[POP]]',
    # UCA government estimate branch.
    129: '', 130: '', 132: '',
    133: '[[IGE_LETTER]]',
    134: '[[IGE_DEFINITIZED]]',
    135: '[[CLAUSES]]',
    137: '', 139: '', 140: '',
    142: '[[NTE]]',
    # Placeholder funding profile table.
    144: '',
    146: '[[FUNDING_NOTE]]',
    # UCA estimate at or below $1M, and the UCA-only contract-type NTE block.
    148: '', 150: '', 152: '', 154: '', 156: '', 158: '', 160: '',
    162: '', 164: '', 166: '', 168: '',
    169: SEC5,
    171: '[[DEFINITIZATION]]',
    # Placeholder definitization schedule table.
    174: '',
    # UCA-only FAR 52.243-6 change order accounting block.
    177: '', 179: '', 180: '', 181: '',
    183: SEC6,
    # UCA-only determination branch.
    184: '', 185: '', 186: '', 188: '',
    189: '[[DETERMINATION]]',
    191: '[[AUTHORIZATION]]',
    # UCA signature page is removed on the letter-contract path.
    192: '', 194: '', 197: '', 198: '', 199: '', 202: '', 203: '',
    207: '', 208: '', 209: '', 210: '', 215: '', 216: '',
    218: '',
    220: '[[SIG_TITLE]]',
    224: '[[CO_NAME]]',
    225: 'Contracting Officer',
    227: 'Concurrence:',
    228: '',
    233: '[[PO_NAME]]',
    234: '[[PO_LINE]]',
    235: 'Approval:',
    240: '[[HCA_NAME]]',
    241: 'Head of Contracting Activity',
}


def build(src, dst):
    temp = '/tmp/uca/master-build'
    shutil.rmtree(temp, ignore_errors=True)
    os.makedirs(temp)
    with zipfile.ZipFile(src) as archive:
        archive.extractall(temp)
    shutil.rmtree(os.path.join(temp, '[trash]'), ignore_errors=True)
    path = os.path.join(temp, 'word/document.xml')
    xml = open(path, encoding='utf8').read()
    elements = list(re.finditer(r'<w:(p|tbl)\b.*?</w:\1>', xml, re.S))
    out, last = [], 0
    for index, match in enumerate(elements):
        out.append(xml[last:match.start()])
        last = match.end()
        if index < BODY_START:
            continue
        element = match.group(0)
        spec = EDITS.get(index)
        if spec is not None:
            element = build_para(element, spec)
        else:
            # Red double-underlined drafter prose never ships.
            element = re.sub(
                r'<w:r\b(?![a-zA-Z])(?:(?!</w:r>).)*?<w:color w:val="(?:FF0000|C00000)"/>.*?</w:r>',
                '', element, flags=re.S,
            )
            element = re.sub(r'<w:highlight w:val="\w+"/>', '', element)
        out.append(element)
    out.append(xml[last:])
    open(path, 'w', encoding='utf8').write(''.join(out))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst):
        os.remove(dst)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as archive:
        for root, _, files in os.walk(temp):
            for filename in files:
                full = os.path.join(root, filename)
                archive.write(full, os.path.relpath(full, temp))
    print('wrote', dst)


SOURCE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/uca/src.docx'
DEST = sys.argv[2] if len(sys.argv) > 2 else '/dev-server/public/forms/UCA_JUST_MASTER.docx'
build(SOURCE, DEST)
