"""Build the Fair Opportunity Exception / Brand Name marker master.

Only word/document.xml is changed: the instruction pages and the Document
History Log are removed, the active justification paragraphs and the four
signature-authority bands become isolated markers, and the source letterhead,
styles, relationships, footer version identifier and signature underscores
remain untouched. Signature ink is never filled in the master.
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
BODY_START = 53


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


HCA_LINE = 'Head of Contracting Activity'

EDITS = {
    # Face
    55: '[[DOC_TITLE]]',
    56: '[[PROGRAM_ACQ_ID]]',
    58: '[[NATURE]]',
    60: '[[SUPPLIES_SERVICES]]',
    62: '[[EST_VALUE]]',
    64: '[[POP]]',
    # The generic FAR 16.507-6(b)(1)-(6) exception block is removed on the
    # brand-name path (FAR 16.507-7).
    65: '', 66: '', 67: '', 68: '', 69: '', 70: '', 71: '', 72: '', 73: '',
    74: '', 75: '', 76: '', 77: '',
    78: '3. Identification of brand-name justification (FAR 16.507-6(d)(2)(iv)):',
    79: '[[BRAND_AUTHORITY]]',
    81: '[[SUPPORTING_RATIONALE]]',
    83: '', 84: '', 85: '', 86: '', 87: '', 88: '', 89: '', 90: '', 91: '',
    92: '', 93: '', 94: '', 95: '',
    99: '[[PRICE_FAIR]]',
    103: '[[OTHER_FACTS]]',
    106: '',
    107: '[[BARRIERS]]',
    # Band 1: up to $900K
    109: '[[SIG_BAND_LE_900K]]',
    110: '[[DOC_TITLE]]',
    114: '',
    118: '[[TECH_REP_NAME]]',
    122: '[[CO_CERT]]',
    127: '[[CO_NAME]]',
    # Band 2: above $900K up to $20M
    130: '[[SIG_BAND_GT_900K_LE_20M]]',
    131: '[[DOC_TITLE]]',
    136: '[[TECH_CERT]]',
    140: '[[TECH_REP_NAME]]',
    144: '[[CO_CERT]]',
    148: '[[CO_NAME]]',
    152: '[[APPROVAL_STATEMENT]]',
    156: '[[APPROVER_NAME]]',
    157: '[[CENTER_NAME]]',
    # Band 3: above $20M and less than $150M
    159: '[[SIG_BAND_GT_20M_LE_150M]]',
    160: '[[DOC_TITLE]]',
    164: '[[TECH_CERT]]',
    168: '[[TECH_REP_NAME]]',
    171: '[[CO_CERT]]',
    175: '[[CO_NAME]]',
    181: '[[ADVOCATE_NAME]]',
    182: '[[CENTER_NAME]]',
    187: '[[APPROVAL_STATEMENT]]',
    190: '[[HCA_NAME]]',
    191: HCA_LINE,
    # Band 4: above $150M
    192: '[[SIG_BAND_GT_150M]]',
    193: '[[DOC_TITLE]]',
    197: '[[TECH_CERT]]',
    201: '[[TECH_REP_NAME]]',
    204: '[[CO_CERT]]',
    208: '[[CO_NAME]]',
    216: '[[PROGRAM_ACQ_ID]]',
    217: '[[DOC_TITLE]]',
    226: '[[ADVOCATE_NAME]]',
    227: '[[CENTER_NAME]]',
    233: '[[HCA_NAME]]',
    234: HCA_LINE,
    240: '[[GC_NAME]]',
    246: '[[AGENCY_ADVOCATE_NAME]]',
    247: 'Agency Competition Advocate',
    252: '[[APPROVAL_STATEMENT]]',
    257: '[[SPE_NAME]]',
}


def build(src, dst):
    temp = '/tmp/foe/master-build'
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


SOURCE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/foe/src.docx'
DEST = sys.argv[2] if len(sys.argv) > 2 else '/dev-server/public/forms/FOE_BRAND_MASTER.docx'
build(SOURCE, DEST)
