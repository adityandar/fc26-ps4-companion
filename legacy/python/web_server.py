#!/usr/bin/env python3
import argparse, csv, html, io, json, os, re
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs
from ps4_companion.catalog import Catalog
from ps4_companion.importer import commit_import, preview_import
from ps4_companion.model import ImportRequest, STANDARD_CHECKPOINTS

ROOT=Path(__file__).resolve().parent
DATA=Path(os.environ.get('FC26_COMPANION_DATA_ROOT', str(ROOT/'data'))); INBOX=DATA/'inbox'; WORKING=DATA/'working-copies'; OUTPUT=DATA

def page(body: str) -> bytes:
    return ("<!doctype html><html><head><meta charset='utf-8'><title>PS4 Companion</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;background:#101116;color:#eee}main{background:#191b22;padding:28px;border-radius:12px}input,select,textarea{display:block;width:100%;margin:8px 0 18px;padding:10px;background:#252833;color:#fff;border:1px solid #555;border-radius:6px}button{padding:11px 18px;border:0;border-radius:6px;background:#9fef00;color:#111;font-weight:700}pre{white-space:pre-wrap;background:#0b0c10;padding:16px;border-radius:8px}.muted{color:#aaa}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{background:#252833;padding:14px;border-radius:8px}.card strong{display:block;font-size:24px;color:#9fef00}.badge{display:inline-block;background:#414857;padding:4px 8px;border-radius:12px}.note{border-left:3px solid #9fef00;padding-left:12px}table{width:100%;border-collapse:collapse;background:#252833}th,td{text-align:left;padding:9px;border-bottom:1px solid #414857}th{color:#9fef00}</style></head><body><main>"+body+"</main></body></html>").encode()

def render_import_summary(record) -> str:
    summary = record.derived_summary
    insights = summary.get('insights', {})
    available = insights.get('available', {})
    unavailable = insights.get('unavailable', [])
    cards = ''.join(f"<div class='card'><span>{label}</span><strong>{html.escape(str(value if value is not None else '—'))}</strong></div>" for label, value in [('Senior players', summary.get('senior_players')), ('Academy players', summary.get('academy_players')), ('Estimated date', summary.get('estimated_date'))])
    missing = ''.join(f"<li>{html.escape(item.replace('_', ' ').capitalize())}</li>" for item in unavailable)
    changes = insights.get('changes', {})
    positions = {0:'GK', 1:'SW', 2:'RWB', 3:'RB', 4:'CB', 5:'CB', 6:'CB', 7:'LB', 8:'LWB', 9:'CDM', 10:'CDM', 11:'CDM', 12:'RM', 13:'CM', 14:'CM', 15:'CM', 16:'LM', 17:'CAM', 18:'CAM', 19:'CAM', 20:'RF', 21:'CF', 22:'LF', 23:'RW', 24:'ST', 25:'ST', 26:'ST', 27:'LW', 28:'SUB', 29:'RES'}
    squad_rows = []
    for player in summary.get('squad_players', []):
        attrs = player.get('attributes', {}); squad = player.get('squad', {})
        position = positions.get(squad.get('position'), f"#{squad.get('position')}")
        contract = player.get('contract', {})
        squad_rows.append(f"<tr><td>{html.escape(str(player.get('name', 'Player')))}</td><td>{html.escape(position)}</td><td>{html.escape(str(attrs.get('overallrating') or '—'))}</td><td>{html.escape(str(attrs.get('potential') or '—'))}</td><td>{html.escape(str(attrs.get('height') or '—'))}</td><td>{html.escape(str(contract.get('contract_status') or attrs.get('contractvaliduntil') or '—'))}</td><td>{html.escape(str(contract.get('wage') or '—'))}</td><td>{html.escape(str(squad.get('jerseynumber') or '—'))}</td><td>{html.escape(str(player.get('name_source') or 'legacy/unknown'))}</td></tr>")
    squad_table = "<h2>Squad</h2><table><thead><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Potential</th><th>Height</th><th>Contract</th><th>Wage</th><th>#</th><th>Name source</th></tr></thead><tbody>" + ''.join(squad_rows) + "</tbody></table>" if squad_rows else ''
    academy_rows = ''.join(f"<tr><td>Player #{html.escape(str(player.get('playerid')))}</td><td>{html.escape(str(player.get('playertier') or '—'))}</td><td>{html.escape(str(player.get('swinglowpotential') or '—'))}</td><td>{html.escape(str(player.get('potentialvariance') or '—'))}</td><td>{html.escape(str(player.get('monthsinsquad') or '—'))}</td></tr>" for player in summary.get('academy_player_records', []))
    academy_table = "<h2>Academy</h2><table><thead><tr><th>Player ID</th><th>Tier</th><th>Low potential</th><th>Potential variance</th><th>Months in squad</th></tr></thead><tbody>" + academy_rows + "</tbody></table>" if academy_rows else ''
    change_cards = ''
    if changes:
        rendered = []
        for key, pair in changes.items():
            if isinstance(pair, (list, tuple)) and len(pair) == 2:
                if pair[0] == pair[1]:
                    continue
                before, after = pair
                rendered.append(f"<div class='card'><span>{html.escape(key.replace('_', ' ').capitalize())}</span><strong>{html.escape(str(before))} → {html.escape(str(after))}</strong></div>")
        if rendered:
            change_cards = "<h2>Changes since previous snapshot</h2><div class='cards'>" + ''.join(rendered) + "</div>"
    note = f"<p class='note'>{html.escape(record.user_note)}</p>" if record.user_note else ''
    return f"<h1>Snapshot imported</h1><p><span class='badge'>{html.escape(insights.get('mode', 'snapshot'))}</span> {html.escape(insights.get('headline', ''))}</p><div class='cards'>{cards}</div>{change_cards}<p><b>Career:</b> {html.escape(record.career_id)}<br><b>Season:</b> {html.escape(record.season)} · <b>Checkpoint:</b> {html.escape(record.checkpoint)}<br><b>SHA-256:</b> <code>{html.escape(record.source_sha256)}</code></p>{squad_table}{academy_table}<p><a href='/export/{html.escape(record.source_sha256)}.csv'>Download snapshot CSV</a></p>{note}<h2>Not available yet</h2><ul>{missing or '<li>All baseline fields available</li>'}</ul><details><summary>Raw parsed record</summary><pre>{html.escape(json.dumps(record.to_dict(),indent=2,ensure_ascii=False))}</pre></details><p><a href='/'>Back</a></p>"

class Handler(BaseHTTPRequestHandler):
    def send_page(self, body, status=200):
        data=page(body); self.send_response(status); self.send_header('Content-Type','text/html; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        demo_match = re.fullmatch(r'/demo/([0-9a-f]{64})', self.path)
        if demo_match:
            record = next((r for r in Catalog(OUTPUT/'catalog.json').records if r.source_sha256 == demo_match.group(1)), None)
            if not record: self.send_page('<h1>Demo snapshot not found</h1>',404); return
            self.send_page(render_import_summary(record)); return
        match = re.fullmatch(r'/export/([0-9a-f]{64})\.csv', self.path)
        if match:
            record = next((r for r in Catalog(OUTPUT/'catalog.json').records if r.source_sha256 == match.group(1)), None)
            if not record: self.send_page('<h1>Snapshot not found</h1>',404); return
            output = io.StringIO(); writer = csv.writer(output); writer.writerow(['playerid','name','name_source','position','overallrating','potential','height','contract','wage','jerseynumber'])
            positions = {0:'GK',1:'SW',2:'RWB',3:'RB',4:'CB',5:'CB',6:'CB',7:'LB',8:'LWB',9:'CDM',10:'CDM',11:'CDM',12:'RM',13:'CM',14:'CM',15:'CM',16:'LM',17:'CAM',18:'CAM',19:'CAM',20:'RF',21:'CF',22:'LF',23:'RW',24:'ST',25:'ST',26:'ST',27:'LW',28:'SUB',29:'RES'}
            for player in record.derived_summary.get('squad_players', []):
                attrs=player.get('attributes',{}); squad=player.get('squad',{}); contract=player.get('contract',{})
                writer.writerow([player.get('playerid'),player.get('name'),player.get('name_source'),positions.get(squad.get('position'),squad.get('position')),attrs.get('overallrating'),attrs.get('potential'),attrs.get('height'),contract.get('contract_status') or attrs.get('contractvaliduntil'),contract.get('wage'),squad.get('jerseynumber')])
            data=output.getvalue().encode(); self.send_response(200); self.send_header('Content-Type','text/csv; charset=utf-8'); self.send_header('Content-Disposition','attachment; filename="fc26-snapshot.csv"'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data); return
        if self.path != '/': self.send_page('<h1>Not found</h1>',404); return
        records=Catalog(OUTPUT/'catalog.json').records
        prefix = '/demo/' if os.environ.get('FC26_COMPANION_DATA_ROOT') else '/demo/'
        rows=''.join(f"<li><a href='{prefix}{r.source_sha256}'>{html.escape(r.club_name)} · {html.escape(r.manager_name)} · {html.escape(r.season)} · {html.escape(r.checkpoint)}</a> · <code>{r.source_sha256[:16]}</code></li>" for r in records)
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
