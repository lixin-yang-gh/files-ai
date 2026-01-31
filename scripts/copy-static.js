const fs = require('fs-extra');
const path = require('path');

async function copyStaticFiles() {
    const srcDir = path.join(__dirname, '../src/renderer');
    const distDir = path.join(__dirname, '../dist/renderer');

    // Create dist directory if it doesn't exist
    await fs.ensureDir(distDir);

    // Copy HTML file
    await fs.copyFile(
        path.join(srcDir, 'index.html'),
        path.join(distDir, 'index.html')
    );

    // Copy CSS file (if it exists as a separate file)
    const stylesSrc = path.join(srcDir, 'styles');
    const stylesDist = path.join(distDir, 'styles');

    if (await fs.pathExists(stylesSrc)) {
        await fs.copy(stylesSrc, stylesDist);
    }

    console.log('Static files copied successfully!');
}

copyStaticFiles().catch(console.error);