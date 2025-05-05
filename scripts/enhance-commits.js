const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const MAX_DIFF_SIZE = 20000; // Characters - truncate if larger
const MAX_FILES_TO_SAMPLE = 5; // Maximum number of files to include in the diff
const SAMPLE_LINES_PER_FILE = 200; // Maximum lines to include per file

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function getLastCommit() {
  return await runCommand('git log -1 --pretty=%H');
}

async function getLastCommitMessage(commitSha) {
  return await runCommand(`git log -1 --pretty=%B ${commitSha}`);
}

function getDirectorySummary(changedFiles) {
  const directories = new Set();
  const componentMapping = {
    'sources': 'Platform Integrations',
    'themes': 'Theming',
    'dock.html': 'Consolidated Chat Dashboard and Overlay UI',
    'featured.html': 'Featured Overlay UI',
    'background.js': 'Extension Core Logic and Message Routing',
    'manifest.json': 'Extension Manifest'
  };
  const knownComponents = new Set();

  for (const { file } of changedFiles) {
    const dirname = path.dirname(file);
    if (dirname !== '.') {
      directories.add(dirname);
    }
    // Check direct file mapping
    if (componentMapping[file]) {
        knownComponents.add(componentMapping[file]);
    } else {
        // Check directory mapping
        const topLevelDir = file.split('/')[0];
        if (componentMapping[topLevelDir]) {
            knownComponents.add(componentMapping[topLevelDir]);
        }
        // Simple keyword check (adjust as needed)
        if (file.includes('tts') || dirname.includes('tts')) knownComponents.add('TTS Module');
        if (file.includes('api') || dirname.includes('api')) knownComponents.add('API Handling');
    }
  }

  let summary = 'Areas changed: ';
  if (knownComponents.size > 0) {
      summary += [...knownComponents].join(', ');
  } else if (directories.size > 0) {
      // Fallback to directories if no components identified
       summary += [...directories].slice(0, 3).join(', ') + (directories.size > 3 ? ', ...' : '');
  } else {
      summary += 'Root level or single file changes.';
  }
  return summary;
}

async function getChangedFiles(commitSha) {
  const fullDiff = await runCommand(`git show ${commitSha} --name-status`);
  return fullDiff
    .split('\n')
    .filter(line => /^[AMDRT]\t/.test(line))
    .map(line => {
      const [status, file] = line.split('\t');
      return { status, file };
    });
}

async function getCommitDiff(commitSha) {
  const fullDiff = await runCommand(`git show ${commitSha} --name-status`);
  const changedFiles = fullDiff
    .split('\n')
    .filter(line => /^[AMDRT]\t/.test(line))
    .map(line => {
      const [status, file] = line.split('\t');
      return { status, file };
    });

  // Limit number of files to process
  const selectedFiles = changedFiles.slice(0, MAX_FILES_TO_SAMPLE);
  
  let combinedDiff = '';
  
  for (const { status, file } of selectedFiles) {
    try {
      // Skip binary files
      const mimeType = await runCommand(`file --mime-type -b "${file}"`);
      if (!mimeType.startsWith('text/')) {
        combinedDiff += `\n[Binary file ${file} changed]\n`;
        continue;
      }
      
      let fileDiff;
      
      if (status === 'A' || status === 'M' || status === 'T') {
        // For added or modified files, get the diff
        fileDiff = await runCommand(`git show ${commitSha} -- "${file}"`);
        
        // Sample the diff if it's too large
        if (fileDiff.split('\n').length > SAMPLE_LINES_PER_FILE) {
          const diffLines = fileDiff.split('\n');
          const header = diffLines.slice(0, 4).join('\n');
          const firstChunk = diffLines.slice(4, 4 + Math.floor(SAMPLE_LINES_PER_FILE / 2)).join('\n');
          const lastChunk = diffLines.slice(-Math.floor(SAMPLE_LINES_PER_FILE / 2)).join('\n');
          fileDiff = `${header}\n${firstChunk}\n...[truncated]...\n${lastChunk}`;
        }
      } else if (status === 'D') {
        // For deleted files, just indicate deletion
        fileDiff = `File ${file} was deleted`;
      } else if (status === 'R') {
        // For renamed files
        fileDiff = `File was renamed to ${file}`;
      }
      
      combinedDiff += `\n\n=== ${status}: ${file} ===\n${fileDiff}`;
    } catch (error) {
      combinedDiff += `\n[Error processing ${file}: ${error.message}]\n`;
    }
  }
  
  // Add info about omitted files if any
  if (changedFiles.length > MAX_FILES_TO_SAMPLE) {
    const omitted = changedFiles.length - MAX_FILES_TO_SAMPLE;
    combinedDiff += `\n\n[...and ${omitted} more files not shown...]`;
  }
  
  // Truncate if still too large
  if (combinedDiff.length > MAX_DIFF_SIZE) {
    combinedDiff = combinedDiff.substring(0, MAX_DIFF_SIZE) + '\n\n[truncated due to size]';
  }
  
  return combinedDiff;
}

async function enhanceCommitMessage(originalMessage, diff, branchName, dirSummary, recentCommits) { // Added params
  const recentCommitLines = recentCommits.length > 0
     ? `* **Recent Steps on Branch:**\n${recentCommits.map(s => `    - ${s}`).join('\n')}`
     : '* **Recent Steps on Branch:** (N/A or first commit)';
  const prompt = `As a developer assistant, please create an improved, detailed git commit message based on the original message, the code changes shown in the diff, and the provided context about the repository.

**Project Context: Social Stream Ninja**

* **Purpose:** Consolidates live social messaging streams (Twitch, YouTube, Facebook, etc.) for content creators.
* **Core Features:** Multi-platform chat aggregation, customizable chat overlay (for OBS/streaming), Text-to-Speech (TTS), bot commands & automation, API support (message ingest/egress, webhooks for donations like Stripe/Ko-Fi), theming, standalone desktop app, and browser extension.
* **Key Components:** \`dock.html\` (main dashboard/controller), \`featured.html\` (chat overlay), \`sources/\` directory (specific platform integrations), \`custom.js\` (user scripting), TTS functionality, API handling logic.
* **Technology Stack:** Primarily JavaScript, HTML, CSS, leveraging Browser Extension APIs, WebRTC (via VDO.Ninja), and potentially Electron for the standalone app.
* **Branch Context:** You are currently on branch \`${branchName}\`
* ${dirSummary}
${recentCommitLines}

**Input:**

Original commit message: "${originalMessage}"

Diff of changes:
\`\`\`
${diff}
\`\`\`

**Instructions for Generating the Commit Message:**

Please generate a professional, detailed commit message that:
1.  Summarizes what was changed in a clear first line (< 72 chars), relevant to the Social Stream Ninja project.
2.  Uses the project context to better understand the purpose and impact of the code changes.
3.  Adds bullets for key changes, explaining *what* was modified (e.g., which feature, platform integration, or component like the dock/overlay/TTS).
4.  Explains *why* changes were made if possible, linking back to project goals (e.g., improving usability, adding a requested feature, fixing a bug on a specific platform).
5.  Mentions key files or components (e.g., \`dock.html\`, \`twitch.js\`, TTS module) that were modified.
6.  Maintains a professional tone suitable for a project like Social Stream Ninja.

Keep your response short and focused on just the enhanced commit message itself, without any explanations or additional text introducing it.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    return null;
  }
}

async function updateCommitMessage(commitSha, newMessage) {
  try {
    // Create a temporary file with the new message
    const tempFile = path.join(process.cwd(), '.temp-commit-msg');
    await fs.writeFile(tempFile, newMessage);
    
    // Amend the commit with the new message
    await runCommand(`git commit --amend -F ${tempFile}`);
    await runCommand(`git push --force`);
    
    // Clean up temp file
    await fs.unlink(tempFile);
    
    return true;
  } catch (error) {
    console.error('Error updating commit message:', error.message);
    return false;
  }
}

async function updatePRDescription() {
  // Only run for PRs
  if (!process.env.GITHUB_EVENT_NAME || process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    return;
  }
  
  try {
    // Get PR information
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const eventData = JSON.parse(await fs.readFile(eventPath, 'utf8'));
    const prNumber = eventData.pull_request.number;
    const repoFullName = process.env.GITHUB_REPOSITORY;
    
    // Get PR diff
    const prDiff = await runCommand(`git diff origin/$(git rev-parse --abbrev-ref HEAD)^...origin/$(git rev-parse --abbrev-ref HEAD)`);
    
    // Get existing PR description
    const prDescription = eventData.pull_request.body || '';
    
    // Generate enhanced description
    const prompt = `As a developer assistant, please create an improved, detailed pull request description based on the original description and the code changes shown in the diff.

Original PR description: "${prDescription}"

Diff of changes:
\`\`\`
${prDiff.substring(0, MAX_DIFF_SIZE)}
\`\`\`

Please generate a professional, detailed PR description that:
1. Summarizes the purpose of the PR
2. Lists main changes and features
3. Provides context on implementation decisions
4. Mentions any potential concerns or future improvements
5. Has a clear, organized structure

Keep your response focused on just the enhanced PR description without any explanations or additional text.`;

    const enhancedDescription = await model.generateContent(prompt);
    
    // Update PR description via GitHub API
    const [owner, repo] = repoFullName.split('/');
    await axios({
      method: 'patch',
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      data: {
        body: enhancedDescription.response.text()
      }
    });
    
    console.log('PR description updated successfully');
  } catch (error) {
    console.error('Error updating PR description:', error.message);
  }
}

async function getBranchName() {
  try {
    return await runCommand('git rev-parse --abbrev-ref HEAD');
  } catch (error) {
    console.warn('Could not get branch name:', error.message);
    return 'unknown';
  }
}

async function getRecentBranchCommits(branchName) {
  if (branchName === 'main' || branchName === 'master' || branchName === 'unknown') {
    return []; // Don't show history relative to main/master itself
  }
  try {
    // Find the merge base with main (adjust 'main' if needed)
    const mergeBase = await runCommand(`git merge-base origin/main HEAD`);
    // Get log subjects since the merge base, limit to 3
    const log = await runCommand(`git log --pretty=%s ${mergeBase}..HEAD -n 3`);
    return log.split('\n').filter(s => s.trim() !== '');
  } catch (error) {
    console.warn('Could not get recent branch commits:', error.message);
    return [];
  }
}

async function main() {
  try {
    // Check if PR update is needed
    await updatePRDescription();
    
    // Get the latest commit
    const commitSha = await getLastCommit();
    const originalMessage = await getLastCommitMessage(commitSha);
    const branchName = await getBranchName();
    const recentCommits = await getRecentBranchCommits(branchName);
    
    // Get the list of changed files for directory summary
    const changedFiles = await getChangedFiles(commitSha);
    const dirSummary = getDirectorySummary(changedFiles);
    
    // Get the diff of the commit
    const diff = await getCommitDiff(commitSha);
    
    // Generate enhanced commit message with the additional context
    const enhancedMessage = await enhanceCommitMessage(
      originalMessage, 
      diff, 
      branchName, 
      dirSummary, 
      recentCommits
    );
    
    if (!enhancedMessage) {
      console.log('Failed to enhance commit message');
      process.exit(1);
    }
    
    // Update the commit message
    const updated = await updateCommitMessage(commitSha, enhancedMessage);
    
    if (updated) {
      console.log('Commit message enhanced successfully');
    } else {
      console.log('Failed to update commit message');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
