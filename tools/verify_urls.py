#!/usr/bin/env python3
"""Verifica URL (download e homepage) per il catalogo wgetApp.

Uso:
    python tools/verify_urls.py <lista.json>
    python tools/verify_urls.py --catalog data [--homepages]

Modalita' --catalog:
    Legge tutti i data/*.json (tranne categories.json) e verifica ogni voce
    replicando il comportamento dell'app:
      - source "github"   -> API releases/latest + assetPattern
      - source "browser"  -> downloadUrl e' una pagina: check con UA browser
      - statico           -> downloadUrl con UA wget (come lo manda wget.exe),
                             GET + Range bytes=0-511 (non scarica il file intero)
    --homepages aggiunge il check dell'homepage di ogni voce (UA browser).
    Sostituisce l'originale check_links.py (ora rimosso).

Formato del file JSON per la modalita' lista (array di voci):
    [
      {"label": "putty 0.85", "kind": "url", "url": "https://...", "ua": "browser"},
      {"label": "wsusoffline", "kind": "github", "repo": "wsusoffline/wsusoffline", "pattern": "^wsusoffline\\d+\\.zip$"},
      {"label": "gitkraken GET", "kind": "method", "url": "https://...", "method": "get"}
    ]

Campi:
  kind    "url" (default, GET + Range bytes=0-511) | "github" (release/latest + asset pattern) | "method" (HEAD/GET esplicito)
  ua      "browser" (default) | "wget" | "plain"
  method  "head" | "get" (solo per kind "method")

Output: tabella riepilogativa + contatore OK/KO. Nessuna dipendenza esterna.
Nota: il check GitHub consuma quota API anonima (60 req/h/IP).
"""
import json
import re
import sys
import urllib.error
import urllib.request

BROWSER_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
UAS = {
    'browser': BROWSER_UA,
    'wget': 'Wget/1.11.4',
    'plain': 'Mozilla/5.0',
}
TIMEOUT = 40
RANGE = 'bytes=0-511'


def _result(**kw):
    return kw


def check_url(url, ua='browser', method='get'):
    req = urllib.request.Request(url, method='HEAD' if method == 'head' else 'GET')
    req.add_header('User-Agent', UAS[ua])
    if method == 'get':
        req.add_header('Range', RANGE)
        req.add_header('Accept', '*/*')
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            body = r.read() if method == 'get' else b''
            cr = r.headers.get('Content-Range', '')
            size = cr.split('/')[-1] if '/' in cr else (r.headers.get('Content-Length', '?') if method == 'head' else len(body))
            magic = body[:4]
            mtxt = ('MZ' if magic[:2] == b'MZ' else
                    '7z' if magic[:6] == b'7z\xBC\xAF\x27\x1C'[:6] else
                    'ISO' if magic[:8] == b'\x00\x01\x00\x00' or 'iso' in r.headers.get('Content-Type', '') else
                    (magic.hex() if magic else ''))
            return _result(ok=True, status=r.status, final=r.geturl(),
                           ctype=r.headers.get('Content-Type', ''), size=size, magic=mtxt)
    except urllib.error.HTTPError as e:
        loc = e.headers.get('Location', '')
        extra = ''
        if e.code in (403, 405) and 'cf-ray' in {k.lower() for k in e.headers.keys()}:
            extra = ' [CF]'
        return _result(ok=False, status=e.code, final=url, loc=loc, extra=extra)
    except Exception as e:
        return _result(ok=False, status='ERR', final=url, err=str(e)[:60])


def check_github(repo, pattern):
    api = 'https://api.github.com/repos/%s/releases/latest' % repo
    req = urllib.request.Request(api)
    req.add_header('User-Agent', 'wgetApp-catalog-check')
    req.add_header('Accept', 'application/vnd.github+json')
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.load(r)
        names = [a['name'] for a in data.get('assets', [])]
        matched = [n for n in names if re.match(pattern, n)]
        return _result(ok=bool(matched), status='API', tag=data.get('tag_name'),
                       matched=matched[:3], n_assets=len(names))
    except urllib.error.HTTPError as e:
        return _result(ok=False, status=e.code, err=e.read()[:100].decode(errors='replace'))
    except Exception as e:
        return _result(ok=False, status='ERR', err=str(e)[:60])


def fmt(res):
    if res.get('ok'):
        bits = ['%s' % res['status'], 'tag=%s' % res['tag'] if 'tag' in res else '',
                '-> %s' % res['final'][:78] if res.get('final', '').count('//') else '',
                'type=%s' % res.get('ctype', '')[:38] if res.get('ctype') else '',
                'size=%s' % res.get('size', '?') if res.get('size') else '',
                'magic=%s' % res['magic'] if res.get('magic') else '',
                'asset=%s' % ', '.join(res['matched']) if res.get('matched') else '']
        return ' '.join(b for b in bits if b)
    bits = ['%s' % res['status'] + res.get('extra', '')]
    if res.get('loc'):
        bits.append('-> %s' % res['loc'][:78])
    if res.get('err'):
        bits.append(res['err'])
    return ' '.join(bits)


def check_catalog(data_dir, include_homepages=False):
    """Costruisce la lista di check da data/*.json, replicando il comportamento dell'app."""
    import pathlib
    items = []
    for f in sorted(pathlib.Path(data_dir).glob('*.json')):
        if f.name == 'categories.json':
            continue
        entries = json.loads(f.read_text(encoding='utf-8-sig'))
        for e in entries:
            eid = '%s/%s' % (f.stem, e.get('id', '?'))
            src = e.get('source', '')
            if src == 'github':
                items.append({'label': eid, 'kind': 'github',
                              'repo': e['repo'], 'pattern': e['assetPattern']})
            elif src == 'browser':
                items.append({'label': eid + ' [page]', 'kind': 'url',
                              'url': e['downloadUrl'], 'ua': 'browser'})
            else:
                items.append({'label': eid, 'kind': 'url',
                              'url': e['downloadUrl'], 'ua': 'wget'})
            if include_homepages and e.get('homepage'):
                items.append({'label': eid + ' [home]', 'kind': 'url',
                              'url': e['homepage'], 'ua': 'browser'})
    return items


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    include_homepages = False
    if args[0] == '--catalog':
        if len(args) < 2:
            print('manca la directory data')
            sys.exit(2)
        i = 1
        while i < len(args) and args[i].startswith('--'):
            if args[i] == '--homepages':
                include_homepages = True
            i += 1
        if i >= len(args):
            print('manca la directory data')
            sys.exit(2)
        items = check_catalog(args[i], include_homepages)
    else:
        with open(args[0], encoding='utf-8-sig') as f:
            items = json.load(f)
    n_ok = 0
    for it in items:
        label = it['label']
        kind = it.get('kind', 'url')
        if kind == 'github':
            res = check_github(it['repo'], it['pattern'])
        elif kind == 'method':
            res = check_url(it['url'], it.get('ua', 'browser'), it.get('method', 'head'))
        else:
            res = check_url(it['url'], it.get('ua', 'browser'), 'get')
        mark = 'OK ' if res.get('ok') else 'KO '
        n_ok += 1 if res.get('ok') else 0
        print('%s %-34s %s' % (mark, label[:34], fmt(res)))
    print('\nTotale: %d su %d' % (n_ok, len(items)))
    sys.exit(0 if n_ok == len(items) else 1)


if __name__ == '__main__':
    main()
