"""Build the Blackout Notice marker master from the attached HQ Word face.

Only word/document.xml is changed: instruction pages and the Document History
Log are removed, the active letter becomes isolated markers, and the source
letterhead, styles, relationships, footer version identifier and signature
underscore remain untouched. Signature ink is never filled in the master.
"""
import html
import os
import re
import shutil
import sys
import zipfile

WT = '<w:t xml:space="preserve">%s</w:t>'
BODY_START = 47


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
        r'<w:color[^/]*/>', r'<w:highlight[^/]*/>', r'<w:u\b[^/]*/>',
        r'<w:rStyle[^/]*/>', r'<w:i\b[^/]*/>', r'<w:b\b[^/]*/>',
    ):
        rpr = re.sub(pattern, '', rpr)
    ppr = re.sub(r'<w:color[^/]*/>|<w:highlight[^/]*/>|<w:u\b[^/]*/>', '', ppr)
    return ppr, rpr


def build_para(paragraph, text):
    ppr, rpr = para_rpr(paragraph)
    segments = [part for part in re.split(r'(\[\[[A-Z0-9_]+\]\])', text) if part]
    runs = ''.join('<w:r>%s%s</w:r>' % (rpr, WT % esc(part)) for part in segments)
    return '<w:p>%s%s</w:p>' % (ppr, runs)


def letterhead(element):
    def replace_text(match):
        text = match.group(0)
        text = text.replace('Select Center Address', '[[CENTER_ADDRESS]]')
        text = text.replace('Select Center', '[[CENTER]]')
        return text
    return re.sub(r'<w:t(?: [^>]*)?>.*?</w:t>', replace_text, element, flags=re.S)


EDITS = {
    47: letterhead,
    50: '[[DATE]]',
    52: 'Reply to Attn of: [[ATTN_OF]]',
    55: 'TO:  NASA Civil Servants',
    57: 'FROM:  [[FROM_LINE]]',
    59: 'SUBJECT:  [[SUBJECT_LINE]]',
    60: '',
    62: 'Applicable references: FAR 15.101; NFS CG 1815.11(i); NFS CG 1815.27(b); NASA Source Selection Guide §3.24.',
    63: '[[ACQUISITION_INTRO]]',
    65: '[[BLACKOUT_BODY]]',
    67: '[[CO_REFERRAL]]',
    69: '[[RELATED_CONTRACTS]]',
    71: '',
    72: '',
    74: '[[OPTIONAL_RESOURCES]]',
    76: '[[RESOURCES_FIREWALL]]',
    78: '_______________________',
    79: '[[SIGNER_NAME]]',
    80: '[[SIGNER_TITLE]]',
}


def build(src, dst):
    temp = '/tmp/blackout/master-build'
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
            element = spec(element) if callable(spec) else build_para(element, spec)
        else:
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


SOURCE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/blackout/src.docx'
DEST = sys.argv[2] if len(sys.argv) > 2 else '/dev-server/public/forms/BLACKOUT_MASTER.docx'
build(SOURCE, DEST)