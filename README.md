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
       branches: [main, master, develop] # Customize as needed
     pull_request:
       types: [ opened, synchronize ]
   jobs:
     enhance-commits:
       runs-on: ubuntu-latest
       permissions:
         contents: write
         pull-requests: write
       steps:
         - name: Checkout code
           uses: actions/checkout@v3
           with:
             fetch-depth: 2
             token: ${{ secrets.COMMIT_ENHANCER_PAT }}
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
         - name: Install dependencies
           run: npm install @google/generative-ai axios
         - name: Configure Git
           run: |
             git config --global user.name "GitHub Actions Commit Enhancer"
             git config --global user.email "actions@github.com"
         - name: Enhance commit messages
           id: enhance
           env:
             GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
             GITHUB_TOKEN: ${{ secrets.COMMIT_ENHANCER_PAT }}
           run: node .github/scripts/enhance-commits.js
   ```

5. **Deploy the script** to `.github/scripts/enhance-commits.js` and push to your repository

## Advanced Features 🔧

- **Smart Diff Handling**: Automatically handles binary files and large diffs
- **Directory Analysis**: Creates a component-aware summary of changes
- **Branch History Analysis**: Incorporates recent commits on the branch for context
- **Conventional Commits Format**: Generates type-scoped messages (feat, fix, etc.)
- **PR Description Enhancement**: Automatically improves PR descriptions with Markdown formatting

## Customization ⚙️

The main script in `.github/scripts/enhance-commits.js` can be customized:

```javascript
// Configuration options
const MAX_DIFF_SIZE = 20000; // Characters - truncate if larger
const MAX_FILES_TO_SAMPLE = 5; // Maximum number of files to include in the diff
const SAMPLE_LINES_PER_FILE = 200; // Maximum lines to include per file
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

## ⚠️ Cost and Risk Disclaimer ⚠️

**Potential Costs:**
- **API Usage Fees**: Gemini API may incur charges based on usage volume and model selection. Monitor your Google Cloud billing closely.
- **GitHub Actions Minutes**: This workflow consumes GitHub Actions minutes, which may affect monthly allocation for private repositories.

**Potential Issues:**
- **Infinite Loop Risk**: Without proper safeguards, the action could potentially trigger itself repeatedly, resulting in excessive API calls and costs.
- **Git History Modification**: The force-push mechanism alters Git history, which can cause conflicts in collaborative environments.
- **API Rate Limiting**: Frequent commits might hit rate limits with the Gemini API.
- **False Positives**: AI may occasionally misinterpret code changes, resulting in inaccurate commit messages.
- **Content Filtering**: Some valid technical terms or code snippets might be filtered by AI content policies.

**Recommended Safeguards:**
- Implement a commit message tag that can skip enhancement (e.g., "[no-enhance]")
- Add logic to detect and break potential recursive triggers
- Set budget alerts on your Google Cloud account
- Test thoroughly in a non-critical branch before deploying to main branches

## General Warning ⚠️
- When deploying and using the action, make sure it doesn't get stuck in a loop running endlessly
- This could either exhaust your LLM API tokens allowances, or end up costing you some money

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

## License 📄

[MIT License](LICENSE)

---

Made with ❤️ for developers who care about commit quality
