#!/usr/bin/env python3
import argparse, json
from pathlib import Path
from ps4_companion.catalog import Catalog
from ps4_companion.importer import commit_import, preview_import
from ps4_companion.model import ImportRequest, STANDARD_CHECKPOINTS

def main() -> None:
    ap=argparse.ArgumentParser(description='Read-only FC26 PS4 snapshot importer')
    ap.add_argument('source', type=Path)
    ap.add_argument('--season', required=True)
    ap.add_argument('--checkpoint', choices=tuple(STANDARD_CHECKPOINTS), required=True)
    ap.add_argument('--note', default='')
    ap.add_argument('--companion-root', type=Path, required=True)
    ap.add_argument('--output-root', type=Path, default=Path('.'))
    ap.add_argument('--working-root', type=Path, default=Path('working-copies/imports'))
    ap.add_argument('--confirm', action='store_true')
    args=ap.parse_args()
    request=ImportRequest(args.source,args.season,args.checkpoint,args.note)
    preview=preview_import(request,args.working_root,args.companion_root)
    print(json.dumps({'career_id':preview.career_id,'manager':preview.parsed.manager_name,'club':preview.parsed.club_name,'season_detected':preview.parsed.season,'estimated_date':preview.parsed.estimated_date,'source_sha256':preview.staged.source_sha256,'working_copy':str(preview.staged.working_copy_path),'senior_players':preview.parsed.senior_players,'academy_players':preview.parsed.academy_players,'checkpoint':args.checkpoint,'checkpoint_label':STANDARD_CHECKPOINTS[args.checkpoint],'confirmed':args.confirm},ensure_ascii=False,indent=2))
    if args.confirm:
        record=commit_import(preview,Catalog(args.output_root/'catalog.json'),args.output_root,confirm=True)
        print(json.dumps({'import_id':record.import_id,'catalog':str(args.output_root/'catalog.json')},indent=2))

if __name__=='__main__': main()
