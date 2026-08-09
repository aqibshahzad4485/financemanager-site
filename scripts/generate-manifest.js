const fs = require('fs');
const path = require('path');

const downloadsDir = path.join(__dirname, '..', 'downloads');
const manifestPath = path.join(downloadsDir, 'manifest.json');

// Parse semantic version from filename (e.g., FinanceManager_V1.0.2.apk -> 1.0.2)
function parseVersion(filename) {
    const match = filename.match(/(?:_v|_V|-v|-V|v|V)?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
    return match ? match[1] : null;
}

// Compare semantic versions (descending order)
function compareVersions(v1, v2) {
    const cleanV1 = v1.split('-')[0];
    const cleanV2 = v2.split('-')[0];
    const parts1 = cleanV1.split('.').map(Number);
    const parts2 = cleanV2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 !== num2) return num2 - num1; // Descending
    }
    return 0;
}

function generateManifest() {
    if (!fs.existsSync(downloadsDir)) {
        console.error('Downloads directory not found:', downloadsDir);
        process.exit(1);
    }

    // Read existing manifest for preserved descriptions
    let existingDescriptions = {};
    if (fs.existsSync(manifestPath)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (Array.isArray(oldData.builds)) {
                oldData.builds.forEach(b => {
                    if (b.filename && b.description) {
                        existingDescriptions[b.filename] = b.description;
                    }
                });
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    const files = fs.readdirSync(downloadsDir);
    const builds = [];

    files.forEach(file => {
        if (!file.endsWith('.apk') && !file.endsWith('.zip') && !file.endsWith('.exe') && !file.endsWith('.dmg')) {
            return;
        }

        const version = parseVersion(file);
        if (!version) return; // Skip non-versioned files like FinanceManager.apk

        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);

        const dateStr = stats.mtime.toISOString().split('T')[0];
        const defaultDesc = `Release build v${version} featuring full offline capabilities and performance optimizations.`;

        builds.push({
            version: version,
            filename: file,
            size: stats.size,
            date: dateStr,
            description: existingDescriptions[file] || defaultDesc
        });
    });

    builds.sort((a, b) => compareVersions(a.version, b.version));

    const manifestData = {
        lastUpdated: new Date().toISOString(),
        builds: builds
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
    console.log(`Successfully generated downloads/manifest.json with ${builds.length} builds.`);
    builds.forEach(b => console.log(`  - v${b.version}: ${b.filename} (${(b.size / (1024 * 1024)).toFixed(1)} MB)`));
}

generateManifest();
