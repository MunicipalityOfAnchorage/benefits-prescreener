/*
 * Benefits Pre-Screener embed loader
 *
 * Put this in a Revize Raw HTML module (no iframe needed):
 *
 *   <div id="benefits-prescreener"></div>
 *   <script src="https://municipalityofanchorage.github.io/benefits-prescreener/embed.js"></script>
 *
 * It pulls the form markup from index.html, the styles from styles.css (scoped so
 * they only touch the pre-screener, not the Revize page), and then runs script.js.
 * Edit those files on GitHub as usual; the Revize page picks up changes on reload.
 */
(function () {
    var MOUNT_ID = 'benefits-prescreener';
    var SCOPE = '#' + MOUNT_ID;
    var me = document.currentScript;
    var BASE = me ? me.src.replace(/[^\/]*(\?.*)?$/, '') : '';
    window.BENEFITS_PRESCREENER_BASE = BASE;

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function get(path) {
        return fetch(BASE + path, { cache: 'no-cache' }).then(function (r) {
            if (!r.ok) throw new Error(path + ' ' + r.status);
            return r.text();
        });
    }

    // Prefix every selector so the styles stay inside the mount
    function scopeSelector(sel) {
        return sel.split(',').map(function (part) {
            part = part.trim();
            if (part === '*') return SCOPE + ', ' + SCOPE + ' *';
            if (part === 'html' || part === 'body') return SCOPE;
            if (/^(html|body)\b/.test(part)) return part.replace(/^(html|body)/, SCOPE);
            if (part.charAt(0) === '*') return SCOPE + ' ' + part + ', ' + SCOPE;
            return SCOPE + ' ' + part;
        }).join(', ');
    }

    function scopeRules(rules) {
        var out = '';
        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            if (r.type === 1) { // style rule
                out += scopeSelector(r.selectorText) + '{' + r.style.cssText + '}\n';
            } else if (r.type === 4) { // @media
                out += '@media ' + r.media.mediaText + '{\n' + scopeRules(r.cssRules) + '}\n';
            } else {
                out += r.cssText + '\n'; // @keyframes etc. pass through
            }
        }
        return out;
    }

    function scopeCss(css) {
        var doc = document.implementation.createHTMLDocument('');
        var style = doc.createElement('style');
        style.textContent = css;
        doc.head.appendChild(style);
        return scopeRules(style.sheet.cssRules);
    }

    function start() {
        var mount = document.getElementById(MOUNT_ID);
        if (!mount) return;

        Promise.all([get('index.html'), get('styles.css')]).then(function (parts) {
            var page = new DOMParser().parseFromString(parts[0], 'text/html');
            var container = page.querySelector('.container');

            var style = document.createElement('style');
            style.textContent = scopeCss(parts[1]) +
                // Sit inside the Revize page rather than filling the screen
                SCOPE + ' .container{min-height:0;max-width:none;padding:0;background:transparent}\n' +
                SCOPE + '{display:block;background:transparent}\n';
            document.head.appendChild(style);

            mount.innerHTML = container ? container.innerHTML : '';

            var papa = window.Papa ? Promise.resolve() :
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
            return papa.then(function () { return loadScript(BASE + 'script.js'); });
        }).catch(function (err) {
            console.error('Benefits pre-screener failed to load', err);
            mount.innerHTML = '<p>The benefits pre-screener could not load. Please refresh the page, or call ' +
                '<a href="tel:211">2-1-1</a> (Alaska 2-1-1) for help finding programs.</p>';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
