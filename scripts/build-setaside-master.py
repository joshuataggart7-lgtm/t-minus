"""Build the set-aside preaward notice master.

Strips the HQ instruction pages and the drafter's colour-coded notes, keeps the
document history table out of the letter, keeps the template version identifier
in the footer, and turns each fill-in into a whole [[MARKER]] run so
applyMarkers can fill or delete it. Signature ink is never added.
"""
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import util as _util

_spec = _util.spec_from_file_location(
    "pa", os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-postaward-masters.py")
)

# The postaward script builds its own masters on import, so the shared helpers
# are copied here instead of imported.
import re, shutil, zipfile

WT = '<w:t xml:space="preserve">%s</w:t>'


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para_rpr(p):
    m = re.search(r"<w:pPr>.*?</w:pPr>", p, re.S)
    ppr = m.group(0) if m else ""
    rm = re.search(r"<w:r\b(?![a-zA-Z]).*?</w:r>", p, re.S)
    rpr = ""
    if rm:
        r = re.search(r"<w:rPr>.*?</w:rPr>", rm.group(0), re.S)
        if r:
            rpr = r.group(0)
    for pat in (r"<w:color[^/]*/>", r"<w:highlight[^/]*/>", r"<w:u\b[^/]*/>", r"<w:rStyle[^/]*/>"):
        rpr = re.sub(pat, "", rpr)
    ppr = re.sub(r"<w:color[^/]*/>", "", ppr)
    ppr = re.sub(r"<w:highlight[^/]*/>", "", ppr)
    return ppr, rpr


def build_para(p, segments):
    ppr, rpr = para_rpr(p)
    runs = []
    for seg in segments:
        if not seg:
            continue
        runs.append("<w:r>%s%s</w:r>" % (rpr, WT % esc(seg)))
    return "<w:p>%s%s</w:p>" % (ppr, "".join(runs))


def split_markers(text):
    return [s for s in re.split(r"(\[\[[A-Z0-9_]+\]\])", text) if s]


def process(src, dst, keep_from, edits, drops):
    tmp = "/tmp/sa/build"
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    with zipfile.ZipFile(src) as z:
        z.extractall(tmp)
    path = os.path.join(tmp, "word/document.xml")
    xml = open(path, encoding="utf8").read()
    els = list(re.finditer(r"<w:(p|tbl)\b.*?</w:\1>", xml, re.S))
    out = []
    last = 0
    for i, el in enumerate(els):
        out.append(xml[last : el.start()])
        last = el.end()
        g = el.group(0)
        if i < keep_from or i in drops:
            continue
        if i in edits:
            spec = edits[i]
            g = spec(g) if callable(spec) else build_para(g, split_markers(spec))
        else:
            g = re.sub(
                r'<w:r\b(?![a-zA-Z])(?:(?!</w:r>).)*?<w:color w:val="FF0000"/>.*?</w:r>',
                "",
                g,
                flags=re.S,
            )
            g = re.sub(r'<w:highlight w:val="\w+"/>', "", g)
        out.append(g)
    out.append(xml[last:])
    open(path, "w", encoding="utf8").write("".join(out))
    if os.path.exists(dst):
        os.remove(dst)
    zf = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
    for root, _, files in os.walk(tmp):
        for f in files:
            full = os.path.join(root, f)
            zf.write(full, os.path.relpath(full, tmp))
    zf.close()
    print("wrote", dst)


def letterhead(g):
    def sub(m):
        t = m.group(0)
        t = t.replace("Select Center Address", "[[CENTER_ADDRESS]]")
        t = t.replace("Select Center", "[[CENTER_NAME]]")
        return t

    g = re.sub(r"<w:t(?: [^>]*)?>.*?</w:t>", sub, g, flags=re.S)
    g = re.sub(r'<w:highlight w:val="\w+"/>', "", g)
    return g


EDITS = {
    51: letterhead,
    54: "[[LETTER_DATE]]",
    56: "Reply to Attn of:  [[ORG_CODE]]",
    58: "[[POC_NAME]]",
    59: "[[POC_TITLE]]",
    60: "[[OFFEROR_NAME]]",
    61: "[[OFFEROR_STREET]]",
    62: "[[OFFEROR_CITY_STATE_ZIP]]",
    63: "SUBJECT:  Preaward Notification for Solicitation No. [[SOLICITATION_NUMBER]] for the [[ACQ_TITLE]] Acquisition",
    64: "Dear [[SALUTATION_NAME]]:",
    69: "In accordance with Federal Acquisition Regulation (FAR) 15.206-1(b)(1), the purpose of this letter is to provide written notification that [[SUCCESS_COMPANY_NAME]] has been selected as the apparent successful offeror for the [[SUCCESS_ACQ_NAME]] acquisition. Other offerors are being notified in accordance with FAR 19.201-2. This notification follows NFS CG 1815.28.",
    71: "No response to this letter is required. If there are no protests to [[SUCCESS_OFFEROR_NAME]]\u2019s small business size status, the Government intends to proceed with formal contract award to [[SUCCESS_OFFEROR_NAME_2]] on or near [[SUCCESS_AWARD_DATE]].",
    75: "[[UNSUCCESS_INTRO]]",
    77: "[[UNSUCCESS_SELECTED_OFFEROR]]",
    78: "[[UNSUCCESS_REVISIONS]]",
    80: "[[UNSUCCESS_CHALLENGE]]",
    82: "[[UNSUCCESS_FOLLOWUP]]",
    84: "For additional information, please contact the undersigned at [[CO_PHONE]] or via email at [[CO_EMAIL]].",
    89: "[[CO_NAME]]",
}

# The HQ master binary, staged from the upload:
#   cp "/mnt/user-uploads/Set-Aside_Preaward_Apparent_Successful_Offeror_Notification-2.docx" /tmp/sa/src.docx
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sa/src.docx"

process(
    SRC,
    "/dev-server/public/forms/SETASIDE_PREAWARD_MASTER.docx",
    51,
    EDITS,
    {67, 68, 73, 76, 79, 81},
)
