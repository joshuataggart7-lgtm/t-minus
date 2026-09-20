import re, shutil, zipfile, os

WT = '<w:t xml:space="preserve">%s</w:t>'

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def para_rpr(p):
    m = re.search(r'<w:pPr>.*?</w:pPr>', p, re.S)
    ppr = m.group(0) if m else ''
    # first run's rPr, stripped of colour/highlight/underline
    rm = re.search(r'<w:r\b(?![a-zA-Z]).*?</w:r>', p, re.S)
    rpr = ''
    if rm:
        r = re.search(r'<w:rPr>.*?</w:rPr>', rm.group(0), re.S)
        if r:
            rpr = r.group(0)
    for pat in (r'<w:color[^/]*/>', r'<w:highlight[^/]*/>', r'<w:u\b[^/]*/>', r'<w:rStyle[^/]*/>'):
        rpr = re.sub(pat, '', rpr)
    # paragraph-mark rPr also loses colour
    ppr = re.sub(r'<w:color[^/]*/>', '', ppr)
    ppr = re.sub(r'<w:highlight[^/]*/>', '', ppr)
    return ppr, rpr

def build_para(p, segments):
    ppr, rpr = para_rpr(p)
    runs = []
    for seg in segments:
        if not seg:
            continue
        runs.append('<w:r>%s%s</w:r>' % (rpr, WT % esc(seg)))
    return '<w:p>%s%s</w:p>' % (ppr, ''.join(runs))

def split_markers(text):
    """Split a string into prose/marker segments so each marker is its own run."""
    return [s for s in re.split(r'(\[\[[A-Z0-9_]+\]\])', text) if s]

def process(src, dst, keep_from, edits, drops):
    tmp = '/tmp/pa/build_' + os.path.basename(dst)
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    with zipfile.ZipFile(src) as z:
        z.extractall(tmp)
    path = os.path.join(tmp, 'word/document.xml')
    xml = open(path, encoding='utf8').read()
    els = list(re.finditer(r'<w:(p|tbl)\b.*?</w:\1>', xml, re.S))
    out = []
    last = 0
    for i, el in enumerate(els):
        out.append(xml[last:el.start()])
        last = el.end()
        g = el.group(0)
        if i < keep_from or i in drops:
            continue
        if i in edits:
            spec = edits[i]
            if callable(spec):
                g = spec(g)
            else:
                g = build_para(g, split_markers(spec))
        else:
            # strip red instruction runs anywhere in kept content
            g = re.sub(r'<w:r\b(?![a-zA-Z])(?:(?!</w:r>).)*?<w:color w:val="FF0000"/>.*?</w:r>', '', g, flags=re.S)
            g = re.sub(r'<w:highlight w:val="\w+"/>', '', g)
        out.append(g)
    out.append(xml[last:])
    xml = ''.join(out)
    open(path, 'w', encoding='utf8').write(xml)
    if os.path.exists(dst):
        os.remove(dst)
    zf = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for root, _, files in os.walk(tmp):
        for f in files:
            full = os.path.join(root, f)
            zf.write(full, os.path.relpath(full, tmp))
    zf.close()
    print('wrote', dst)

# ------------------------------------------------------------------ successful
def letterhead(g):
    def sub(m):
        t = m.group(0)
        t = t.replace('Select Center Address', '[[CENTER_ADDRESS]]')
        t = t.replace('Select Center', '[[CENTER_NAME]]')
        return t
    g = re.sub(r'<w:t(?: [^>]*)?>.*?</w:t>', sub, g, flags=re.S)
    g = re.sub(r'<w:highlight w:val="\w+"/>', '', g)
    return g

S_EDITS = {
    61: letterhead,
    66: 'Reply to Attn of:  [[ORG_CODE]]',
    68: '[[POC_NAME]]',
    69: '[[POC_TITLE]]',
    70: '[[OFFEROR_NAME]]',
    71: '[[OFFEROR_STREET]]',
    72: '[[OFFEROR_CITY_STATE_ZIP]]',
    73: 'SUBJECT:  Postaward Notification for Solicitation No. [[SOLICITATION_NUMBER]] for the [[ACQ_TITLE]] Acquisition',
    74: 'Dear [[SALUTATION_NAME]]:',
    75: 'Congratulations, the National Aeronautics and Space Administration (NASA) [[CENTER_NAME_BODY]] has determined that [[COMPANY_NAME]]\u2019s proposal represents the best value to the Government in response to the subject solicitation. Therefore, [[CENTER_NAME_BODY2]] has selected the proposal for award. The source selection statement accompanying this letter documents the rationale for the selection decision. The contract [[CONTRACT_NUMBER]] has an effective date of [[EFFECTIVE_DATE]].',
    76: 'Pursuant to FAR 15.301-1(a)(1), offerors may request a postaward debriefing in writing within three calendar days of receipt of this letter. In the event a debriefing is requested, one will be arranged upon receipt of the written request. Written requests must be submitted via e-mail to: [[CO_EMAIL]]',
    77: '[[NOTICE_AUTHORITY_LINE]]',
    79: 'NASA would like to express its appreciation for the time and effort that went into your proposal submission and we look forward to working with you on the [[ACQ_TITLE_SHORT]] contract.',
    81: 'For additional information, please contact the undersigned at [[CO_PHONE]] or via e-mail.',
    88: '[[CO_NAME]]',
    89: '[[CO_TITLE]]',
    92: '[[ENCLOSURE_1]]',
}
process('/tmp/pa/s.docx', '/dev-server/public/forms/POSTAWARD_SUCCESS_MASTER.docx', 61, S_EDITS, {78, 93})

# ---------------------------------------------------------------- unsuccessful
U_EDITS = {
    39: '[[LETTER_DATE]]',
    40: '[[ORG_CODE]]',
    43: '[[OFFEROR_ADDRESS_BLOCK]]',
    46: 'Subject:  Postaward Notification for Solicitation No. [[SOLICITATION_NUMBER]] for the [[ACQ_TITLE]] Contract',
    47: 'Dear [[SALUTATION_NAME]],',
    48: 'This notification is to inform [[COMPANY_NAME]] that the National Aeronautics and Space Administration (NASA) [[CENTER_NAME_BODY]] has awarded a contract under the subject solicitation and your proposal was not selected for award.',
    50: '[[NOTICE_AUTHORITY_LINE]]',
    51: 'Number of offerors solicited: [[OFFERORS_SOLICITED]]',
    52: 'Number of proposals received: [[PROPOSALS_RECEIVED]]',
    53: 'Name and address of each offeror receiving an award: [[AWARDEES]]',
    54: 'Maximum contract value including options: [[CONTRACT_VALUE]] [[VALUE_PERIOD]]',
    55: 'In making the selection decision, all evaluation factors [[EVALUATION_FACTORS]] were considered. The rationale for selecting [[SELECTED_OFFEROR]] is delineated in the enclosed source selection statement.',
    56: 'Pursuant to FAR 15.301-1, offerors may request a post award debriefing in writing within three calendar days after receipt of this letter. In the event a debriefing is requested, one will be arranged after receipt of the written request by the contracting officer. Written requests shall be submitted via e-mail to: [[CO_EMAIL]]',
    57: '[[PROPOSAL_DISPOSITION]]',
    58: 'NASA appreciates [[COMPANY_NAME_2]] proposal submission and encourages continued interest in future NASA acquisitions. For additional information, please contact the undersigned at [[CO_PHONE]] or via e-mail. Please confirm receipt of this letter by replying to this e-mail.',
    61: '[[CO_NAME]]',
    62: '[[CO_TITLE]]',
    64: '[[ENCLOSURE_1]]',
}
process('/tmp/pa/u.docx', '/dev-server/public/forms/POSTAWARD_UNSUCCESS_MASTER.docx', 39, U_EDITS, set())
