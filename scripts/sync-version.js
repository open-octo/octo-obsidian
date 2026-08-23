#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const versionsPath = path.join(__dirname, '..', 'versions.json');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const versionsJson = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

const newVersion = packageJson.version;

manifestJson.version = newVersion;

// Obsidian's community plugin store reads versions.json to map each plugin
// version to its minimum app version — a release missing from this file is
// invisible to users checking for updates.
if (!(newVersion in versionsJson)) {
  versionsJson[newVersion] = manifestJson.minAppVersion;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + '\n');
fs.writeFileSync(versionsPath, JSON.stringify(versionsJson, null, 2) + '\n');

console.log(`Synced version to ${newVersion}`);
