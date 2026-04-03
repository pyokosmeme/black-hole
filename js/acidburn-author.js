/**
 * ACIDBURN AUTHOR CONTENT SYSTEM
 * 
 * Handles loading and displaying author info, links, and posts
 * from JSON config and markdown files.
 * 
 * USAGE:
 * Set window.PAGE_CONFIG before loading this script:
 * 
 *   <script>
 *     window.PAGE_CONFIG = {
 *       configPath: 'maps/config.json',  // path to config.json
 *       contentDir: 'maps/',              // base path for content files
 *       titleSuffix: 'SPECULATIVE MAPS'   // appended to page title
 *     };
 *   </script>
 *   <script src="js/acidburn-author.js"></script>
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // PAGE CONFIG (can be overridden per-page)
    // ═══════════════════════════════════════════════════════════════
    
    const PAGE = window.PAGE_CONFIG || {};
    const CONFIG_PATH = PAGE.configPath || 'author/config.json';
    const CONTENT_DIR = PAGE.contentDir || 'author/';
    const TITLE_SUFFIX = PAGE.titleSuffix || 'transmissions';

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    let CONFIG = null;
    let POSTS = [];
    const SEED = Date.now();
    let rngState = SEED;

    // ═══════════════════════════════════════════════════════════════
    // SEEDED RANDOM (for consistent effects)
    // ═══════════════════════════════════════════════════════════════

    function seededRandom() {
        rngState |= 0;
        rngState = rngState + 0x6d2b79f5 | 0;
        let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIG LOADING
    // ═══════════════════════════════════════════════════════════════

    async function loadConfig() {
        console.log('[ACIDBURN Author] Loading config from:', CONFIG_PATH);
        const response = await fetch(CONFIG_PATH);
        if (!response.ok) throw new Error('Failed to load ' + CONFIG_PATH);
        CONFIG = await response.json();
        return CONFIG;
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTHOR INFO
    // ═══════════════════════════════════════════════════════════════

    function loadAuthorInfo() {
        if (!CONFIG) return;
        
        const { author } = CONFIG;
        
        const headerBrand = document.getElementById('header-brand');
        const authorName = document.getElementById('author-name');
        const authorHandle = document.getElementById('author-handle');
        const authorTagline = document.getElementById('author-tagline');
        const authorAvatar = document.getElementById('author-avatar');
        
        if (headerBrand) headerBrand.textContent = author.handle;
        if (authorName) authorName.textContent = author.name;
        if (authorHandle) authorHandle.textContent = '@' + author.handle;
        if (authorTagline) authorTagline.textContent = author.tagline;
        if (authorAvatar) authorAvatar.textContent = author.avatar;
        
        document.title = `${author.handle} // ${TITLE_SUFFIX}`;

        // Load avatar image if specified
        if (author.avatar_image) {
            const avatarContainer = document.querySelector('.author-avatar');
            if (avatarContainer) {
                const img = document.createElement('img');
                img.src = CONTENT_DIR + author.avatar_image;
                img.alt = author.name;
                img.onload = () => {
                    avatarContainer.classList.add('has-image');
                    avatarContainer.appendChild(img);
                };
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BIO LOADING
    // ═══════════════════════════════════════════════════════════════

    async function loadBio() {
        if (!CONFIG) return;
        
        try {
            const response = await fetch(CONTENT_DIR + CONFIG.author.bio_file);
            if (!response.ok) throw new Error('Failed to load bio');
            const markdown = await response.text();
            const bioEl = document.getElementById('author-bio');
            if (bioEl && typeof marked !== 'undefined') {
                bioEl.innerHTML = marked.parse(markdown);
            }
        } catch (error) {
            console.error('[ACIDBURN Author] Error loading bio:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LINKS
    // ═══════════════════════════════════════════════════════════════

    function loadLinks() {
        if (!CONFIG || !CONFIG.links) return;
        
        const grid = document.getElementById('links-grid');
        if (!grid) return;
        
        grid.innerHTML = CONFIG.links.map(link => `
            <a href="${link.url}" class="link-card" target="${link.url.startsWith('http') ? '_blank' : '_self'}" rel="noopener">
                <div class="link-card-inner">
                    <span class="link-icon">${link.icon}</span>
                    <div class="link-text">
                        <h3>${link.label}</h3>
                        <p>${link.desc}</p>
                    </div>
                    <span class="link-arrow">→</span>
                </div>
            </a>
        `).join('');
    }

    // ═══════════════════════════════════════════════════════════════
    // POSTS
    // ═══════════════════════════════════════════════════════════════

    async function loadPostsIndex() {
        if (!CONFIG) return;
        
        try {
            const response = await fetch(CONTENT_DIR + CONFIG.posts_index);
            if (!response.ok) throw new Error('Failed to load posts index');
            const markdown = await response.text();
            POSTS = parsePostsMarkdown(markdown);
            renderPostsList();
        } catch (error) {
            console.error('[ACIDBURN Author] Error loading posts index:', error);
        }
    }

    function parsePostsMarkdown(markdown) {
        const posts = [];
        // Normalize line endings to LF only
        const normalized = markdown.replace(/\r\n/g, '\n');
        const sections = normalized.split(/^## /m).slice(1);

        for (const section of sections) {
            const lines = section.trim().split('\n');
            const slug = lines[0].trim();
            const post = { slug };
            let excerptLines = [];
            let inMeta = true;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim().startsWith('- ') && inMeta) {
                    const match = line.match(/^\s*-\s*(\w+):\s*(.+)$/);
                    if (match) {
                        const [, key, value] = match;
                        if (key === 'tags') {
                            post.tags = value.split(',').map(t => t.trim());
                        } else {
                            post[key] = value.trim();
                        }
                    }
                } else if (line.trim() !== '') {
                    inMeta = false;
                    excerptLines.push(line);
                }
            }
            if (!post.tags) post.tags = [];
            post.excerpt = excerptLines.join(' ').trim();
            posts.push(post);
        }
        return posts;
    }

    function renderPostsList() {
        const list = document.getElementById('posts-list');
        if (!list) return;
        
        list.innerHTML = POSTS.map(post => `
            <a href="#post/${post.slug}" class="post-card" data-slug="${post.slug}">
                <div class="post-meta">
                    <span class="post-date">${post.date || ''}</span>
                    <div class="post-tags">
                        ${(post.tags || []).map(tag => `<span class="post-tag">#${tag}</span>`).join('')}
                    </div>
                </div>
                <h3>${post.title || post.slug}</h3>
                <p>${post.excerpt || ''}</p>
                <span class="post-read-more">CONTINUE SIGNAL →</span>
            </a>
        `).join('');
        
        // Add click handlers
        list.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.AcidburnAuthor && window.AcidburnAuthor.loadPost) {
                    window.AcidburnAuthor.loadPost(card.dataset.slug);
                } else {
                    loadPost(card.dataset.slug);
                }
            });
        });
    }

    async function loadPost(slug) {
        const post = POSTS.find(p => p.slug === slug);
        if (!post) return;

        window.location.hash = `post/${slug}`;
        
        const indexView = document.getElementById('index-view');
        const postView = document.getElementById('post-view');
        const postDate = document.getElementById('post-view-date');
        const postTags = document.getElementById('post-view-tags');
        const postContent = document.getElementById('post-content');
        
        if (indexView) indexView.classList.add('hidden');
        if (postView) postView.classList.add('active');
        if (postDate) postDate.textContent = post.date || '';
        if (postTags) {
            postTags.innerHTML = (post.tags || [])
                .map(tag => `<span class="post-tag">#${tag}</span>`)
                .join('');
        }

        if (postContent) {
            postContent.innerHTML = '<div class="loading">LOADING SIGNAL</div>';

            try {
                // Ensure CONTENT_DIR doesn't cause double slashes or weird relative pathing
                const fetchPath = (CONTENT_DIR + post.file).replace(/^\/+/, '');
                const response = await fetch(window.location.origin + '/' + fetchPath);
                if (!response.ok) throw new Error('Failed to load post');
                const markdown = await response.text();
                if (typeof marked !== 'undefined') {
                    postContent.innerHTML = marked.parse(markdown);
                }
            } catch (error) {
                console.error('[ACIDBURN Author] Fetch error:', error);
                postContent.innerHTML = '<p class="error">ERROR: Signal corrupted.</p>';
            }
        }
        
        window.scrollTo(0, 0);
    }

    function showIndex() {
        window.location.hash = '';
        const indexView = document.getElementById('index-view');
        const postView = document.getElementById('post-view');
        if (indexView) indexView.classList.remove('hidden');
        if (postView) postView.classList.remove('active');
        window.scrollTo(0, 0);
    }

    function handleHashChange() {
        const hash = window.location.hash;
        if (hash.startsWith('#post/')) {
            loadPost(hash.replace('#post/', ''));
        } else {
            showIndex();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    async function init() {
        // Display seed
        const seedEl = document.getElementById('seed-display');
        if (seedEl) seedEl.textContent = SEED;
        
        try {
            await loadConfig();
            loadAuthorInfo();
            loadLinks();
            await loadBio();
            await loadPostsIndex();
            handleHashChange();
            window.addEventListener('hashchange', handleHashChange);
        } catch (error) {
            console.error('[ACIDBURN Author] Failed to initialize:', error);
        }
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    window.AcidburnAuthor = {
        showIndex: showIndex,
        loadPost: loadPost,
        getConfig: () => CONFIG,
        getPosts: () => POSTS,
        getSeed: () => SEED
    };

    // Also expose showIndex globally for onclick handlers
    window.showIndex = showIndex;

})();
