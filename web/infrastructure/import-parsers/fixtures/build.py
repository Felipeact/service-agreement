"""Builds the .docx fixtures for the import parser tests from literal WordprocessingML.

Run from this folder: python build.py. Each document's tables and paragraphs are spelled out below,
so the counts the checks name (C458, C459, C462, C470) can be read here.
"""

import zipfile

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def paragraph(text):
    return f'<w:p><w:r><w:t xml:space="preserve">{text}</w:t></w:r></w:p>'


def table(rows):
    body = "".join("<w:tr>" + "".join(f"<w:tc>{paragraph(cell)}</w:tc>" for cell in row) + "</w:tr>" for row in rows)
    return f"<w:tbl>{body}</w:tbl>"


def document(blocks):
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        + "".join(blocks)
        + "</w:body></w:document>"
    )


def write(name, blocks):
    with zipfile.ZipFile(name, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", CONTENT_TYPES)
        docx.writestr("_rels/.rels", RELS)
        docx.writestr("word/document.xml", document(blocks))


# Table 1: 3 columns, a header and 10 data rows. Table 2: 4 columns, a header and 5 data rows.
# The last table has 1 column, so it is not counted.
write(
    "two-tables.docx",
    [
        table([["Unit", "Type", "Location"]] + [[f"RTU-{i}", "Rooftop unit", "Roof"] for i in range(1, 11)]),
        paragraph("Mechanical room access via the north stairwell"),
        table([["Unit", "Type", "Model", "Location"]] + [[f"EF-{i}", "Exhaust fan", "Greenheck G-90", "Level 2"] for i in range(1, 6)]),
        table([["Notes"], ["Keys at the front desk"], ["Call ahead"]]),
    ],
)

write("text-only.docx", [paragraph("Boiler room has two Lochinvar boilers"), paragraph("Rooftop has four RTUs")])

write("blank.docx", [paragraph("   "), paragraph(" ")])
