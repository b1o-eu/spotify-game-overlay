#!/usr/bin/env node
/**
 * Build script for Spotify Game Menu Desktop App
 * Handles building for different platforms with proper error handling
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if assets exist and warn about placeholder icons
function checkAssets() {
    const assetsDir = path.join(__dirname, 'assets');
    const requiredIcons = ['icon.png', 'icon.ico', 'icon.icns', 'tray-icon.png'];
    
    console.log('Checking assets...');
    
    for (const icon of requiredIcons) {
        const iconPath = path.join(assetsDir, icon);
            if (!fs.existsSync(iconPath)) {
            console.warn(`Warning: ${icon} not found in assets/`);
        } else {
            const stats = fs.statSync(iconPath);
            if (stats.size < 100) { // Very small file, likely placeholder
                console.warn(`Warning: ${icon} appears to be a placeholder (${stats.size} bytes)`);
            }
        }
    }
    
    console.log('Note: Replace placeholder icons in assets/ before distribution\n');
}

// Build for specific platform
function build(platform) {
    return new Promise((resolve, reject) => {
        const buildCommands = {
            'win': 'electron-builder --win',
            'mac': 'electron-builder --mac', 
            'linux': 'electron-builder --linux',
            'all': 'electron-builder --win --mac --linux'
        };
        
        const command = buildCommands[platform];
        if (!command) {
            reject(new Error(`Unknown platform: ${platform}`));
            return;
        }
        
        console.log(`Building for ${platform}...`);
        console.log(`Running: ${command}\n`);
        
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`uild failed for ${platform}:`, error);
                reject(error);
            } else {
                console.log(`Build completed for ${platform}`);
                resolve({ platform, stdout, stderr });
            }
        });
        
        // Stream output in real-time
        child.stdout.on('data', (data) => {
            process.stdout.write(data);
        });
        
        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const platform = args[0] || 'current';
    
    console.log('Spotify Game Menu - Build Script\n');
    
    // Check assets first
    checkAssets();
    
    try {
        if (platform === 'all') {
            console.log('Building for all platforms...\n');
            await build('all');
        } else if (['win', 'mac', 'linux'].includes(platform)) {
            await build(platform);
        } else {
            // Build for current platform
            console.log('Building for current platform...\n');
            await build('current');
        }
        
    console.log('\nBuild completed successfully!');
    console.log('Check the dist/ folder for your built packages');
        
    } catch (error) {
    console.error('\nBuild failed:', error.message);
        process.exit(1);
    }
}

// Handle command line usage
if (require.main === module) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log(`
Spotify Game Menu - Build Script

Usage: node build.js [platform]

Platforms:
  win     - Build for Windows (.exe, .msi)
  mac     - Build for macOS (.dmg)
  linux   - Build for Linux (.AppImage, .deb)
  all     - Build for all platforms
  current - Build for current platform (default)

Examples:
  node build.js win
  node build.js all
  node build.js

Note: Replace placeholder icons in assets/ before building for distribution.
        `);
        process.exit(0);
    }
    
    main();
}

module.exports = { build, checkAssets };