document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Check local storage for theme preference, default to system preference
    const currentTheme = localStorage.getItem('theme') || (prefersDarkScheme.matches ? 'dark' : 'light');
    
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerHTML = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.innerHTML = '🌙';
    }

    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeToggleBtn.innerHTML = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggleBtn.innerHTML = '☀️';
        }
    });

    // Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100;

        revealElements.forEach((el) => {
            const elementTop = el.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                el.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger once on load

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if(mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                navLinks.classList.remove('active');
            }
        });
        // Close menu when a link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    // Helper: Parse semantic version string from filename (e.g. FinanceManager_V1.0.2.apk -> 1.0.2)
    function parseVersion(filename) {
        const match = filename.match(/(?:_v|_V|-v|-V|v|V)?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
        return match ? match[1] : null;
    }

    // Helper: Compare semantic versions (descending order)
    function compareVersions(v1, v2) {
        const cleanV1 = v1.split('-')[0];
        const cleanV2 = v2.split('-')[0];
        const parts1 = cleanV1.split('.').map(Number);
        const parts2 = cleanV2.split('.').map(Number);
        const maxLength = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < maxLength; i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 !== num2) return num2 - num1;
        }
        return 0;
    }

    // Helper: Format bytes to MB string
    function formatBytes(bytes) {
        if (!bytes || isNaN(bytes)) return '36.0 MB';
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(1) + ' MB';
    }

    // Helper: Format date string
    function formatDate(dateStr) {
        if (!dateStr) return 'August 2026';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        } catch (e) {
            return dateStr;
        }
    }

    // Multi-layer Build Discovery Strategy
    async function loadBuilds() {
        let buildsMap = new Map();

        // 1. Try downloads/manifest.json
        try {
            const res = await fetch('downloads/manifest.json?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.builds)) {
                    data.builds.forEach(b => {
                        if (b.filename && b.version) {
                            buildsMap.set(b.filename, {
                                version: b.version,
                                filename: b.filename,
                                size: b.size,
                                date: b.date || '',
                                description: b.description || `Release build v${b.version} with offline performance optimizations.`,
                                downloadUrl: `downloads/${b.filename}`
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.debug('Manifest fetch notice:', e);
        }

        // 2. Try GitHub Contents API (for GitHub Pages deployments)
        try {
            const res = await fetch('https://api.github.com/repos/aqibshahzad4485/financemanager-site/contents/downloads');
            if (res.ok) {
                const files = await res.json();
                if (Array.isArray(files)) {
                    files.forEach(f => {
                        if (f.name && (f.name.endsWith('.apk') || f.name.endsWith('.zip') || f.name.endsWith('.exe'))) {
                            const version = parseVersion(f.name);
                            if (version && !buildsMap.has(f.name)) {
                                buildsMap.set(f.name, {
                                    version: version,
                                    filename: f.name,
                                    size: f.size || 0,
                                    date: '',
                                    description: `Release build v${version} featuring full offline capabilities.`,
                                    downloadUrl: `downloads/${f.name}`
                                });
                            } else if (version && buildsMap.has(f.name)) {
                                const existing = buildsMap.get(f.name);
                                if (!existing.size && f.size) existing.size = f.size;
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.debug('GitHub API fetch notice:', e);
        }

        // 3. Try directory index autoindex parsing
        try {
            const res = await fetch('downloads/');
            if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
                const htmlText = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const links = doc.querySelectorAll('a[href]');
                links.forEach(a => {
                    const href = a.getAttribute('href');
                    const filename = href ? href.split('/').pop() : '';
                    if (filename && (filename.endsWith('.apk') || filename.endsWith('.zip'))) {
                        const version = parseVersion(filename);
                        if (version && !buildsMap.has(filename)) {
                            buildsMap.set(filename, {
                                version: version,
                                filename: filename,
                                size: 0,
                                date: '',
                                description: `Release build v${version} featuring full offline capabilities.`,
                                downloadUrl: `downloads/${filename}`
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.debug('Directory index fetch notice:', e);
        }

        // Convert Map to Array & Sort by Version Descending
        const builds = Array.from(buildsMap.values());
        builds.sort((a, b) => compareVersions(a.version, b.version));
        return builds;
    }

    // Render builds to downloads.html & site-wide buttons
    async function initDownloadsAutoListing() {
        const builds = await loadBuilds();
        if (!builds || builds.length === 0) return;

        const latestBuild = builds[0]; // Highest version number

        // Update all site-wide download buttons
        const siteDownloadBtns = document.querySelectorAll('.apk-download-btn');
        siteDownloadBtns.forEach(btn => {
            btn.href = latestBuild.downloadUrl;
            btn.setAttribute('download', latestBuild.filename);
        });

        // Update Featured Card (Latest Build) on downloads.html
        const versionBadge = document.getElementById('latest-version-badge');
        const filenameCode = document.getElementById('latest-filename');
        const filesizeSpan = document.getElementById('latest-filesize');
        const downloadBtn = document.getElementById('latest-download-btn');

        if (versionBadge) versionBadge.textContent = 'v' + latestBuild.version;
        if (filenameCode) filenameCode.textContent = latestBuild.filename;
        if (filesizeSpan) filesizeSpan.textContent = formatBytes(latestBuild.size);
        if (downloadBtn) {
            downloadBtn.href = latestBuild.downloadUrl;
            downloadBtn.setAttribute('download', latestBuild.filename);
        }

        // Update Previous Builds Archive List on downloads.html
        const archiveList = document.getElementById('builds-archive-list');
        if (archiveList) {
            archiveList.innerHTML = builds.map((build, index) => {
                const isLatest = index === 0;
                return `
                <div class="build-item">
                    <div class="build-info">
                        <div class="build-header">
                            <span class="build-title">Finance Manager Build V${build.version}</span>
                            <span class="badge-version">${isLatest ? 'v' + build.version + ' (Latest)' : 'v' + build.version}</span>
                        </div>
                        <p class="build-desc">${build.description}</p>
                        <div class="build-details">
                            <span>📦 <code>${build.filename}</code></span>
                            <span>⚖️ ${formatBytes(build.size)}</span>
                            <span>📅 ${formatDate(build.date)}</span>
                        </div>
                    </div>
                    <div class="build-action">
                        <a href="${build.downloadUrl}" download="${build.filename}" class="btn btn-outline btn-icon-download">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>Download v${build.version}</span>
                        </a>
                    </div>
                </div>
                `;
            }).join('');
        }
    }

    initDownloadsAutoListing();
});

