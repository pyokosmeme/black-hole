"""Validate share metadata without JavaScript; --live checks public crawler responses."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
import io
import json
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://lastnpcalex.agency'
SLUGS = [x['id'] for x in json.loads((ROOT/'maps/config.json').read_text())['links']] + ['maps']

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.canonicals = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            key = a.get('property', a.get('name'))
            if key:
                self.meta.setdefault(key, []).append(a.get('content'))
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonicals.append(a.get('href'))

def check(slug, content, get_image):
    assert b'<meta charset="utf-8">' in content[:1024], slug
    head = Head()
    head.feed(content.decode('utf-8'))
    for key in ['og:type','og:site_name','og:title','og:description','og:url','og:image','og:image:width','og:image:height','og:image:type','og:image:alt','twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt']:
        assert len(head.meta.get(key, [])) == 1 and head.meta[key][0], (slug, key)
    m = {k:v[0] for k,v in head.meta.items()}
    assert head.canonicals == [ORIGIN+'/'+slug] and m['og:url']==head.canonicals[0]
    assert m['twitter:card']=='summary_large_image'
    assert m['og:image']==m['twitter:image']==ORIGIN+'/img/social/'+slug+'-v1.jpg'
    assert m['og:title']==m['twitter:title']
    assert m['og:image:type']=='image/jpeg' and (m['og:image:width'],m['og:image:height'])==('1200','630')
    data = get_image(m['og:image'])
    image = Image.open(io.BytesIO(data))
    assert image.format=='JPEG' and image.size==(1200,630)
    assert len(data)<300000, (slug,len(data))
    print('PASS metadata + JPEG:',slug,flush=True)

if '--live' in sys.argv:
    revision = subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True).strip()
    def fetch(url):
        with urlopen(Request(url+'?social='+revision,headers={'User-Agent':'facebookexternalhit/1.1','Cache-Control':'no-cache'}),timeout=30) as r:
            assert r.status==200
            data=r.read()
            if '/img/social/' in url:
                assert r.headers.get_content_type()=='image/jpeg'
                assert data==(ROOT/url.split(ORIGIN+'/')[1]).read_bytes()
            return data
    for slug in SLUGS:
        check(slug,fetch(ORIGIN+'/'+slug),fetch)
else:
    for slug in SLUGS:
        current=(ROOT/(slug+'.html')).read_bytes()
        prior=subprocess.check_output(['git','show','HEAD:'+slug+'.html'],cwd=ROOT).replace(b'\r\n',b'\n')
        assert current.replace(b'\r\n',b'\n').split(b'</head>',1)[1]==prior.split(b'</head>',1)[1],slug
        check(slug,current,lambda url:(ROOT/url.split(ORIGIN+'/')[1]).read_bytes())
    print('PASS static HTML metadata with no JavaScript; page bodies unchanged.')
