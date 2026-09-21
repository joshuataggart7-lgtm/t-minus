"""Build the Option Exercise Determination marker master from the HQ template.

Only word/document.xml is changed: the instruction pages and the Document
History Log are removed, the active determination paragraphs become isolated
markers, and the source letterhead, styles, relationships, footer version
identifier, and signature lines remain untouched.
"""
import html
import os
import re
import shutil
import sys
import zipfile

WT = '<w:t xml:space="preserve">%s</w:t>'

# The determination starts here; everything before it is instruction/history.
BODY_START = 48


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
    48: 'OPTION EXERCISE DETERMINATION',
    49: '[[CONTRACT_LINE]]',
    51: '[[INTRO]]',
    53: '[[FUNDS]]',
    54: '[[REQUIREMENT]]',
    56: '[[SCOPE]]',
    58: '[[SYNOPSIS]]',
    59: '[[SAM_CHECK]]',
    61: '[[PERFORMANCE]]',
    62: '[[PRICE]]',
    64: '[[CONSIDERATION]]',
    # The alternative basis paragraph is carried by [[CONSIDERATION]].
    65: '',
    67: '[[COMPETITION]]',
    68: '[[DETERMINATION]]',
    72: '____________________________',
    73: '[[CO_NAME]]',
    74: 'Contracting Officer',
    75: '____________________________',
    76: '[[COR_NAME]]',
    77: 'Contracting Officer\u2019s Representative',
}


def build(src, dst):
    temp = '/tmp/oe/master-build'
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


SOURCE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/oe/src.docx'
DEST = sys.argv[2] if len(sys.argv) > 2 else '/dev-server/public/forms/OPTION_EXERCISE_MASTER.docx'
build(SOURCE, DEST)
