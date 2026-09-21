"""Build the Option Justification marker master from the attached HQ template.

Only word/document.xml is changed: the instruction pages and the Document
History Log are removed, the active memorandum paragraphs become isolated
markers, and the source letterhead, styles, relationships, footer version
identifier, and signature line remain untouched.
"""
import html
import os
import re
import shutil
import sys
import zipfile

WT = '<w:t xml:space="preserve">%s</w:t>'

# The memorandum starts here; everything before it is instruction/history.
BODY_START = 57


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
    ppr = re.sub(r'<w:color[^/]*/>|<w:highlight[^/]*/>', '', ppr)
    return ppr, rpr


def build_para(paragraph, text):
    ppr, rpr = para_rpr(paragraph)
    segments = [part for part in re.split(r'(\[\[[A-Z0-9_]+\]\])', text) if part]
    runs = ''.join('<w:r>%s%s</w:r>' % (rpr, WT % esc(part)) for part in segments)
    return '<w:p>%s%s</w:p>' % (ppr, runs)


EDITS = {
    57: 'MEMORANDUM FOR RECORD',
    59: 'FROM:  [[FROM_LINE]]',
    61: 'SUBJECT:  Justification for Use of Options in Solicitation [[SOLICITATION_LINE]]',
    63: '[[INCLUSION]]',
    65: '',
    67: '[[BASIS]]',
    69: '',
    71: '',
    72: '[[EVALUATION]]',
    73: '[[NOTIFICATION]]',
    78: '___________________________________',
    79: '[[CO_NAME]]',
    80: 'Contracting Officer',
}


def build(src, dst):
    temp = '/tmp/oj/master-build'
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


SOURCE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/oj/src.docx'
DEST = sys.argv[2] if len(sys.argv) > 2 else '/dev-server/public/forms/OPTION_JUST_MASTER.docx'
build(SOURCE, DEST)
