#!/usr/bin/env python3
import argparse, html, json, os, re
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs
from ps4_companion.catalog import Catalog
from ps4_companion.importer import commit_import, preview_import
from ps4_companion.model import ImportRequest, STANDARD_CHECKPOINTS

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; INBOX=DATA/'inbox'; WORKING=DATA/'working-copies'; OUTPUT=DATA

def page(body: str) -> bytes:
    return ("<!doctype html><html><head><meta charset='utf-8'><title>PS4 Companion</title><style>body{font:16px system-ui;max-width:850px;margin:40px auto;background:#101116;color:#eee}main{background:#191b22;padding:28px;border-radius:12px}input,select,textarea{display:block;width:100%;margin:8px 0 18px;padding:10px;background:#252833;color:#fff;border:1px solid #555;border-radius:6px}button{padding:11px 18px;border:0;border-radius:6px;background:#9fef00;color:#111;font-weight:700}pre{white-space:pre-wrap;background:#0b0c10;padding:16px;border-radius:8px}.muted{color:#aaa}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{background:#252833;padding:14px;border-radius:8px}.card strong{display:block;font-size:24px;color:#9fef00}.badge{display:inline-block;background:#414857;padding:4px 8px;border-radius:12px}.note{border-left:3px solid #9fef00;padding-left:12px}</style></head><body><main>"+body+"</main></body></html>").encode()

def render_import_summary(record) -> str:
    summary = record.derived_summary
    insights = summary.get('insights', {})
    available = insights.get('available', {})
    unavailable = insights.get('unavailable', [])
    cards = ''.join(f"<div class='card'><span>{label}</span><strong>{html.escape(str(value if value is not None else '—'))}</strong></div>" for label, value in [('Senior players', summary.get('senior_players')), ('Academy players', summary.get('academy_players')), ('Estimated date', summary.get('estimated_date'))])
    missing = ''.join(f"<li>{html.escape(item.replace('_', ' ').capitalize())}</li>" for item in unavailable)
    note = f"<p class='note'>{html.escape(record.user_note)}</p>" if record.user_note else ''
    return f"<h1>Snapshot imported</h1><p><span class='badge'>{html.escape(insights.get('mode', 'snapshot'))}</span> {html.escape(insights.get('headline', ''))}</p><div class='cards'>{cards}</div><p><b>Career:</b> {html.escape(record.career_id)}<br><b>Season:</b> {html.escape(record.season)} · <b>Checkpoint:</b> {html.escape(record.checkpoint)}<br><b>SHA-256:</b> <code>{html.escape(record.source_sha256)}</code></p>{note}<h2>Not available yet</h2><ul>{missing or '<li>All baseline fields available</li>'}</ul><details><summary>Raw parsed record</summary><pre>{html.escape(json.dumps(record.to_dict(),indent=2,ensure_ascii=False))}</pre></details><p><a href='/'>Back</a></p>"

class Handler(BaseHTTPRequestHandler):
    def send_page(self, body, status=200):
        data=page(body); self.send_response(status); self.send_header('Content-Type','text/html; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path != '/': self.send_page('<h1>Not found</h1>',404); return
        records=Catalog(OUTPUT/'catalog.json').records
        rows=''.join(f"<li>{html.escape(r.club_name)} · {html.escape(r.manager_name)} · {html.escape(r.season)} · {html.escape(r.checkpoint)} · <code>{r.source_sha256[:16]}</code></li>" for r in records)
        options=''.join(f"<option value='{k}'>{v}</option>" for k,v in STANDARD_CHECKPOINTS.items())
        self.send_page(f"<h1>FC26 PS4 Companion</h1><p class='muted'>Local-only snapshot importer. Original saves are never written.</p><form method='post' enctype='multipart/form-data'><label>Apollo DATA file</label><input type='file' name='save' required><label>Season</label><input name='season' placeholder='2026/27' required><label>Checkpoint</label><select name='checkpoint'>{options}<option value='custom'>Custom</option></select><label>Note</label><textarea name='note' rows='4'></textarea><button>Preview and import</button></form><h2>Imported snapshots</h2><ul>{rows or '<li>None</li>'}</ul>")
    def do_POST(self):
        length=int(self.headers.get('Content-Length','0'))
        if length>100*1024*1024: self.send_page('<h1>Upload too large</h1>',413); return
        body=self.rfile.read(length); content_type=self.headers.get('Content-Type','')
        if 'multipart/form-data' not in content_type: self.send_page('<h1>Expected multipart upload</h1>',400); return
        msg=BytesParser(policy=default).parsebytes(b'Content-Type: '+content_type.encode()+b'\r\nMIME-Version: 1.0\r\n\r\n'+body)
        fields={}; uploaded=None
        for part in msg.iter_parts():
            disposition=part.get('Content-Disposition',''); match=re.search(r'name="([^"]+)"',disposition)
            if not match: continue
            name=match.group(1); value=part.get_payload(decode=True) or b''
            filename=part.get_filename()
            if filename: uploaded=value
            else: fields[name]=value.decode('utf-8','replace')
        if not uploaded: self.send_page('<h1>No save uploaded</h1>',400); return
        INBOX.mkdir(parents=True,exist_ok=True); source=INBOX/'uploaded-DATA'; source.write_bytes(uploaded)
        checkpoint=fields.get('checkpoint','season_start'); season=fields.get('season',''); note=fields.get('note','')
        if checkpoint=='custom': checkpoint=fields.get('custom_checkpoint','custom') or 'custom'
        try:
            preview=preview_import(ImportRequest(source,season,checkpoint,note),WORKING,Path(os.environ.get('FC26_COMPANION_ROOT', str(ROOT))))
            record=commit_import(preview,Catalog(OUTPUT/'catalog.json'),OUTPUT,confirm=True)
            self.send_page(render_import_summary(record))
        except Exception as exc: self.send_page(f"<h1>Import failed</h1><pre>{html.escape(str(exc))}</pre><p><a href='/'>Back</a></p>",500)
    def log_message(self,*args): pass

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--port',type=int,default=4130); args=ap.parse_args()
    print(f'FC26 PS4 Companion: http://127.0.0.1:{args.port}')
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
if __name__=='__main__': main()
