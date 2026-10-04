"""Subscriber maintenance UI with isolated API mocks; no live subscribers touched."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import json
import mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
fixture=(ROOT/'tests/admin-browser-fixture.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in [(390,844),(1366,768)]:
        records=[dict(id='a'*64,email='test@example.com',topics=['books'],status='active',source='test signup',createdAt='2026-01-01',updatedAt='2026-01-01')]
        mutations=[]
        failures=set()
        def serve(route):
            url=urlparse(route.request.url)
            if url.path=='/api/admin/subscribers':
                method=route.request.method
                if method=='GET':
                    route.fulfill(json={'subscribers':records})
                elif method in failures:
                    route.fulfill(status=500,json={'error':'Test storage failure'})
                elif method=='PATCH':
                    item=route.request.post_data_json
                    mutations.append(method)
                    records[0]={**records[0],**item,'id':'b'*64,'updatedAt':'2026-02-01'}
                    route.fulfill(json={'subscriber':records[0]})
                elif method=='DELETE':
                    mutations.append(method)
                    records.clear()
                    route.fulfill(json={'ok':True})
                return
            if url.hostname=='fonts.googleapis.com':
                route.fulfill(body=(ROOT/'tests/fixtures/acidburn-fonts.css').read_bytes(),content_type='text/css')
                return
            if url.hostname!='admin.test':
                route.abort()
                return
            path=(ROOT/unquote(url.path).lstrip('/')).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                route.fulfill(status=404,body='Not found');return
            route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        # Set native fetch before the existing editor fixture mocks other endpoints.
        context=browser.new_context(viewport={'width':width,'height':height})
        context.route('**/*',serve)
        context.add_init_script('window.__realSubscriberFetch=window.fetch.bind(window);\n'+fixture+'''\n
          const otherFetch=window.fetch;
          window.fetch=(path,options)=>String(path)==='/api/admin/subscribers'
            ? window.__realSubscriberFetch(path,options) : otherFetch(path,options);
        ''')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('https://admin.test/admin.html')
        page.wait_for_selector('#workspace:not([hidden])')
        page.locator('#maintenance-tools summary').click()
        page.locator('#load-maintenance').click()
        page.wait_for_selector('#subscriber-list button')
        assert page.locator('#subscriber-count').inner_text()=='1'
        page.get_by_role('button',name='Edit test@example.com',exact=True).click()
        page.locator('#subscriber-form [name="email"]').fill('edited@example.com')
        page.locator('#subscriber-form [name="status"]').select_option('unsubscribed')
        page.locator('#subscriber-form [value="blog"]').check()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('#subscriber-form').screenshot(path=str(ROOT/'attached_files'/f'admin-subscriber-editor-{width}.png'))
        failures.add('PATCH')
        page.get_by_role('button',name='Save subscriber',exact=True).click()
        page.wait_for_function("document.querySelector('#subscriber-status').textContent.includes('Test storage failure')")
        assert page.locator('#subscriber-form [name="email"]').input_value()=='edited@example.com'
        assert page.locator('#subscriber-count').inner_text()=='1'
        failures.clear()
        page.get_by_role('button',name='Save subscriber',exact=True).click()
        page.wait_for_function("document.querySelector('#subscriber-status').textContent.includes('Saved edited')")
        assert page.locator('#subscriber-form').is_hidden()
        assert page.locator('#subscriber-count').inner_text()=='0'
        assert mutations==['PATCH']
        page.locator('#load-maintenance').click()
        page.wait_for_selector('button[aria-label="Delete edited@example.com"]')
        page.get_by_role('button',name='Delete edited@example.com',exact=True).click()
        page.locator('#acid-confirm-cancel').click()
        assert mutations==['PATCH']
        assert page.locator('#subscriber-list tr').count()==1
        page.get_by_role('button',name='Delete edited@example.com',exact=True).click()
        page.locator('#acid-confirm-ok').click()
        page.wait_for_function("document.querySelector('#subscriber-status').textContent.includes('Deleted edited')")
        assert mutations==['PATCH','DELETE']
        assert page.locator('#subscriber-list').inner_text()=='No subscribers yet.'
        assert not errors,errors
        page.screenshot(path=str(ROOT/'attached_files'/f'admin-subscriber-{width}.png'))
        print('PASS subscriber edit, failed save preservation, refresh, delete cancellation and deletion:',width,flush=True)
        context.close()
    context=browser.new_context(viewport={'width':1366,'height':768})
    context.route('**/*',serve)
    context.add_init_script(fixture)
    page=context.new_page()
    page.goto('https://admin.test/admin.html')
    page.wait_for_function('window.adminTest !== undefined')
    checks=page.evaluate('adminTest.run()')
    print('PASS existing admin editor workflow:',len(checks),'checks',flush=True)
    context.close()
    browser.close()
