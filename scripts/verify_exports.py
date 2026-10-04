"""Reopen browser downloads with pypdf, independently of the app's PDF engine."""
import json
import sys
from pathlib import Path
from pypdf import PdfReader

manifest = Path(sys.argv[1])
checks = json.loads(manifest.read_text(encoding="utf-8"))
for check in checks:
    reader = PdfReader(check["path"])
    assert len(reader.pages) == len(check["pages"]), check["path"]
    for page, expected in zip(reader.pages, check["pages"]):
        text = page.extract_text() or ""
        assert expected["text"] in text, (check["path"], expected["text"], text)
        if "width" in expected:
            assert abs(float(page.mediabox.width) - expected["width"]) < 0.1
            assert abs(float(page.mediabox.height) - expected["height"]) < 0.1
        assert int(page.get("/Rotate", 0)) % 360 == expected.get("rotation", 0)
        if expected.get('image'):
            resources=page['/Resources'].get_object()
            images=resources.get('/XObject', {}).get_object()
            assert any(ref.get_object().get('/Subtype')=='/Image' for ref in images.values()), 'Scanned image was lost'
    print(f'PASS: {Path(check["path"]).name}: {len(reader.pages)} pages, text/order/rotation preserved')
print(f"Verified {len(checks)} exported PDF files with pypdf.")
