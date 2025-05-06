# Commit Message Enhancer 🚀

> 💡 Automatically generate detailed, consistent commit messages and PR descriptions using Google's Gemini AI

This GitHub Action transforms basic commit messages into comprehensive, contextual descriptions by analyzing your code changes. Say goodbye to cryptic commit histories and hello to clear, professional documentation of your development process.

## How It Works 🔄

When triggered by pushes or PR events, the action:

1. Extracts code changes (diff) from commits or PRs
2. Analyzes directory structure and recent branch history
3. Sends the original message, diff, and context to Gemini API
4. Generates a detailed enhancement using Conventional Commits format
5. Updates the commit message or PR description automatically

**Key Feature:** Modifies Git history by amending commits and force-pushing. Be aware of implications when working in shared branches.

## Example Commit

![image](https://github.com/user-attachments/assets/26d057f2-03bb-44f5-9378-c82cf5d04eee)

[Go check out this AI-generated commit yourself and explore the repo that is using this Github Action!](https://github.com/steveseguin/social_stream/commit/78317940c7c4096f81f4bdffbacd672a8feeddf7)

## Requirements 🔑

- GitHub repository
- Google AI Studio or Google Cloud access for Gemini API key
- GitHub Personal Access Token (PAT)

## Setup 🛠️

1. **Create directory structure**:
   ```
   .github/
   ├── workflows/
   │   └── enhance-commits.yml
   └── scripts/
       └── enhance-commits.js
   ```

2. **Generate API Keys**:
   - **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/)
   - **GitHub PAT**: 
   1. Go to GitHub → Settings → Developer settings → Personal access tokens
   2. Create a new token (classic) or fine-grained token
   3. For fine-grained tokens, ensure it has these permissions:
      - Repository permissions: Read and Write access for "Contents" and "Pull requests"
   4. For classic tokens, select the `repo` scope (which includes pull request access)

3. **Add Repository Secrets**:
   - Add `GEMINI_API_KEY` and `COMMIT_ENHANCER_PAT` in your repo settings

4. **Create workflow file** at `.github/workflows/enhance-commits.yml`:
   ```yaml
   name: Enhance Commit Messages
   on:
     push:
       branches: [main, master, beta, develop]
     pull_request:
       types: [opened, synchronize]
   jobs:
     enhance-commits:
       runs-on: ubuntu-latest
       if: |
         !contains(github.event.head_commit.message, 'Enhance Commit Messages') && 
         !contains(github.event_name, 'pages-build-deployment') && 
         !contains(github.event.head_commit.message, 'Update enhance-commits') && 
         !contains(github.event.head_commit.message, '[no-enhance]') &&
         !startsWith(github.event.head_commit.message, '```') &&
         !contains(github.event.head_commit.message, 'Merge pull request') &&
         !contains(github.event.head_commit.message, 'Merge branch') &&
         !contains(github.event.head_commit.message, 'Version bump') &&
         !contains(github.event.head_commit.message, 'Release v')
       permissions:
         contents: write
         pull-requests: write
       concurrency:
         group: enhance-commits-${{ github.ref }}
         cancel-in-progress: true
       steps:
         - name: Checkout code
           uses: actions/checkout@v4
           with:
             fetch-depth: 5
             token: ${{ secrets.COMMIT_ENHANCER_PAT }}
         
         - name: Check last run time
           id: check_time
           run: |
             CURRENT_TIME=$(date +%s)
             LAST_RUN_FILE=".last_enhance_run"
             
             # Create timestamp dir if it doesn't exist
             mkdir -p $(dirname "$LAST_RUN_FILE")
             
             # Check if file exists and is non-empty
             if [ -f "$LAST_RUN_FILE" ]; then
               if [ -s "$LAST_RUN_FILE" ]; then
                 LAST_RUN=$(cat "$LAST_RUN_FILE")
                 # Verify it's a valid number
                 if [[ "$LAST_RUN" =~ ^[0-9]+$ ]]; then
                   TIME_DIFF=$((CURRENT_TIME - LAST_RUN))
                   
                   if [ $TIME_DIFF -lt 300 ]; then
                     echo "Too soon since last run (${TIME_DIFF}s). Skipping."
                     echo "skip=true" >> $GITHUB_OUTPUT
                     exit 0
                   else
                     echo "Last run was ${TIME_DIFF}s ago. Proceeding."
                   fi
                 else
                   echo "Invalid timestamp in file. Continuing."
                 fi
               else
                 echo "Empty timestamp file. Continuing."
               fi
             else
               echo "No timestamp file found. Continuing."
             fi
             
             echo "$CURRENT_TIME" > "$LAST_RUN_FILE"
             echo "skip=false" >> $GITHUB_OUTPUT
         
         - name: Setup Node.js
           if: steps.check_time.outputs.skip != 'true'
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'npm'
         
         - name: Install dependencies
           if: steps.check_time.outputs.skip != 'true'
           run: npm install @google/generative-ai axios
         
         - name: Configure Git
           if: steps.check_time.outputs.skip != 'true'
           run: |
             git config --global user.name "GitHub Actions Commit Enhancer"
             git config --global user.email "actions@github.com"
             
         - name: Enhance commit messages
           if: steps.check_time.outputs.skip != 'true'
           id: enhance
           env:
             GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
             GITHUB_TOKEN: ${{ secrets.COMMIT_ENHANCER_PAT }}
             ENHANCE_SKIP_TERMS: "Update enhance-commits,Enhance Commit Messages,skip ci,Merge pull,Version bump,Release v"
           run: |
             node .github/scripts/enhance-commits.js || {
               echo "::error::Failed to enhance commit messages"
               exit 1
             }
         
         - name: Update timestamp file
           if: steps.check_time.outputs.skip != 'true'
           run: |
             git add "$LAST_RUN_FILE"
             git commit -m "Update enhance-commits timestamp [skip ci]" || echo "No changes to commit"
             git push origin ${GITHUB_REF_NAME} || echo "::warning::Failed to push timestamp update"
   ```

5. **Deploy the script** to `.github/scripts/enhance-commits.js` and push to your repository

## Advanced Features 🔧

- **Smart Diff Handling**: Automatically handles binary files and large diffs
- **Directory Analysis**: Creates a component-aware summary of changes
- **Branch History Analysis**: Incorporates recent commits on the branch for context
- **Conventional Commits Format**: Generates type-scoped messages (feat, fix, etc.)
- **PR Description Enhancement**: Automatically improves PR descriptions with Markdown formatting
- **Loop Prevention**: Rate limiting (5-minute cooldown) and commit message filtering
- **Concurrency Control**: Prevents multiple instances from running simultaneously

## Anti-Looping Safeguards ⚠️

The action now includes several mechanisms to prevent infinite loops:

1. **Rate Limiting**: Enforces a 5-minute cooldown between runs
2. **Message Filtering**: Skips commits with specific terms in the message:
   - `Enhance Commit Messages`
   - `Update enhance-commits`
   - `[no-enhance]` (manual skip tag)
   - `Merge pull request`
   - `Merge branch`
   - `Version bump`
   - `Release v`
3. **Branch Filtering**: Only runs on specific branches (main, master, beta, develop)
4. **Event Filtering**: Skips pages-build-deployment events
5. **Concurrency Control**: Uses GitHub's concurrency groups to prevent parallel runs

## Customization ⚙️

The main script in `.github/scripts/enhance-commits.js` can be customized:

```javascript
// Configuration options
const MAX_DIFF_SIZE = 20000; // Characters - truncate if larger
const MAX_FILES_TO_SAMPLE = 5; // Maximum number of files to include in the diff
const SAMPLE_LINES_PER_FILE = 200; // Maximum lines to include per file
const MIN_RUN_INTERVAL = 300; // Minimum seconds between runs (5 minutes)
```

### AI Model

The script uses Google's Gemini 2.5 Flash Preview model by default:

```javascript 
model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });
```

You can update to newer models as Google releases them.

### Component Mapping

**Important:** You must update the component mapping in the script to reflect your project structure:

```javascript
// In enhance-commits.js
const componentMapping = {
  'sources': 'Platform Integrations',
  'themes': 'Theming',
  'dock.html': 'Consolidated Chat Dashboard and Overlay UI',
  'featured.html': 'Featured Overlay UI',
  'background.js': 'Extension Core Logic and Message Routing',
  'manifest.json': 'Extension Manifest',
  '.github': 'GitHub Actions/Workflows',
  'scripts': 'Utility Scripts'
  // Replace with your project's file paths and component descriptions
};
```

This mapping helps the AI understand the purpose of different files in your project and creates more meaningful commit messages.

### Custom Repository Context

The script provides robust repository context to Gemini:

```javascript
**Project Context: Your Project Name**

* **Purpose:** What your project does
* **Core Features:** Key features of your project
* **Key Components:** Important files/directories
* **Technology Stack:** Languages and technologies used
```

Modify this context in the prompt template to match your project's specifics.

### AI Provider Flexibility

While the script uses Google's Gemini API by default, you can modify it to work with other AI providers:

```javascript
// Example: Replace Gemini implementation with another LLM API
// 1. Update the imports and initialization
// const { OpenAI } = require('openai'); // Instead of GoogleGenerativeAI
// const client = new OpenAI(process.env.OPENAI_API_KEY); // Use your preferred API key

// 2. Modify the API call in enhanceCommitMessage function
// const result = await client.chat.completions.create({
//   model: "gpt-4",
//   messages: [{ role: "user", content: prompt }]
// });
// return result.choices[0].message.content;
```

## Security Considerations 🔒

- **Force Pushing**: This action uses `git push --force --no-verify` - use carefully in shared branches
- **Token Security**: Keep API keys and PATs secure using GitHub Secrets
- **API Costs**: Monitor Gemini API usage to avoid unexpected charges
- **Large Commits**: Very large changes are sampled and truncated before sending to the API
- **Binary Files**: Binary files are detected and handled appropriately in diffs
- **Timestamp Tracking**: Uses a timestamp file to enforce rate limiting between runs

## ⚠️ Cost and Risk Disclaimer ⚠️

**Potential Costs:**
- **API Usage Fees**: Gemini API may incur charges based on usage volume and model selection. Monitor your Google Cloud billing closely.
- **GitHub Actions Minutes**: This workflow consumes GitHub Actions minutes, which may affect monthly allocation for private repositories.

**Potential Issues:**
- **Infinite Loop Risk**: Now mitigated with multiple safeguards: commit message filtering, rate limiting, and branch filtering.
- **Git History Modification**: The force-push mechanism alters Git history, which can cause conflicts in collaborative environments.
- **API Rate Limiting**: Frequent commits might hit rate limits with the Gemini API.
- **False Positives**: AI may occasionally misinterpret code changes, resulting in inaccurate commit messages.
- **Content Filtering**: Some valid technical terms or code snippets might be filtered by AI content policies.

**Implemented Safeguards:**
- Commit message tag that can skip enhancement (e.g., "[no-enhance]")
- Timestamp-based rate limiting (5-minute cooldown)
- Message content filtering to prevent recursive triggers
- Concurrency control to prevent parallel runs
- Branch filtering to limit where the action runs

## Error Handling 🛠️

The script includes robust error handling:
- Custom ScriptError class with context
- Structured logging with levels (debug, info, warn, error)
- Graceful degradation if specific operations fail

## Troubleshooting 🛠️

- Check action logs for specific error messages (look for `[ERROR]` entries)
- Verify secret names and permissions 
- Validate API keys are active and correct
- Consider breaking down large commits if exceeding size limits
- If PR description updates fail, check your PAT permissions
- If the action seems to be running in a loop, check the `.last_enhance_run` file and consider adding more skip terms

## License 📄

[MIT License](LICENSE)

---

Made with ❤️ for developers who care about commit quality
