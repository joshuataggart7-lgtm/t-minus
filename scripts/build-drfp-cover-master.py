"""Build the DRFP cover marker master from the attached HQ Word template.

Only word/document.xml is changed: instruction/history pages are removed,
active letter paragraphs become isolated markers, and the source letterhead,
styles, relationships, footer version identifier, and signature line remain.
"""
import html
import os
import re
import shutil
import sys
import zipfile

WT = '<w:t xml:space="preserve">%s</w:t>'


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
        r'<w:b\b[^/]*/>',
    ):
        rpr = re.sub(pattern, '', rpr)
    ppr = re.sub(r'<w:color[^/]*/>|<w:highlight[^/]*/>', '', ppr)
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
        text = text.replace('Select Center', '[[CENTER_NAME]]')
        return text
    return re.sub(r'<w:t(?: [^>]*)?>.*?</w:t>', replace_text, element, flags=re.S)


EDITS = {
    51: letterhead,
    56: 'Reply to Attn of:  [[ORG_CODE]]',
    58: 'TO:  All Potential Offerors',
    59: 'SUBJECT:  Draft Request for Proposal (DRFP), Solicitation No. [[SOLICITATION_NUMBER]], for',
    60: '[[ACQ_TITLE]]',
    62: '[[INTRO]]',
    64: '[[COMMENTS_REQUEST]]',
    66: '[[COMPETITION_CONTRACT_POP]]',
    68: 'Potential offerors should ensure their company is listed in the online database(s) for the following:',
    70: 'System for Award Management: https://www.sam.gov/SAM/',
    71: 'U.S. Department of Labor Veterans’ Employment and Training Service, VETS-4212 Reports: https://vets4212.dol.gov/vets4212/',
    72: 'U.S. Government unique entity identifier (UEI): https://www.gsa.gov/about-us/organization/federal-acquisition-service/technology-transformation-services/integrated-award-environment-iae/iae-systems-information-kit/unique-entity-identifier-update',
    74: '[[FINAL_RFP_SCHEDULE]]',
    76: '[[AWARD_PERFORMANCE]]',
    77: '[[ADDITIONAL_INTRO]]',
    78: '[[PHASE_IN]]',
    80: '[[PROPERTY]]',
    82: '[[INDUSTRY_EVENT]]',
    83: '[[SITE_VISITS]]',
    85: '[[OCI]]',
    87: '[[AI_INSTRUCTION]]',
    89: '[[AI_TRANSPARENCY]]',
    92: '[[SECURITY]]',
    94: '[[EFSS]]',
    96: '[[OTHER_EMPHASIS]]',
    98: 'To control and protect sensitive data owned by the Government and its Contractors, NASA policy requires all acquisition-related documents be released in Adobe Portable Document Format (PDF).',
    99: 'Documents related to this acquisition, including this letter, the solicitation, attachments, exhibits, any amendments, and links to online reference or technical libraries will be attainable electronically through the Government-wide point of entry at www.SAM.gov. Potential offerors are requested to monitor the website for updates.',
    100: 'NFS 1852.215-84, OMBUDSMAN, is applicable. The Ombudsman for this acquisition is [[OMBUDSMAN]].',
    101: '[[OMBUDSMAN_LINK]]',
    103: '[[DISCLAIMER]]',
    104: '[[COMMENT_INSTRUCTIONS]]',
    105: '_________________________',
    106: '[[CO_NAME]]',
    107: 'Contracting Officer',
    108: 'Enclosures:',
    109: 'Draft RFP [[DRFP_NUMBER]]',
    110: 'Template for Submission of Comments',
}


def build(src, dst):
    temp = '/tmp/drfp/master-build'
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
        if index < 51:
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


SOURCE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/user-uploads/Draft_Request_For_Proposal_DRFP_Cover_Letter.docx'
DEST = sys.argv[2] if len(sys.argv) > 2 else '/dev-server/public/forms/DRFP_COVER_MASTER.docx'
build(SOURCE, DEST)
