# Commit Message Enhancer 🚀

[![GitHub Actions Status](https://github.com/steveseguin/auto-enhance-commits/actions/workflows/enhance-commits.yml/badge.svg)](https://github.com/steveseguin/auto-enhance-commits/actions/workflows/enhance-commits.yml)

> 💡 Automatically generate detailed, consistent commit messages and PR descriptions using Google's Gemini AI

This GitHub Action transforms basic commit messages into comprehensive, contextual descriptions by analyzing your code changes. Say goodbye to cryptic commit histories and hello to clear, professional documentation of your development process.

## How It Works 🔄

![Commit Enhancement Flow](https://api.placeholder.com/400/320)

When triggered by pushes or PR events, the action:

1. Extracts code changes (diff) from commits or PRs
2. Sends the original message and diff to Gemini API
3. Generates a detailed enhancement based on your code context
4. Updates the commit message or PR description automatically

**Key Feature:** Modifies Git history by amending commits and force-pushing. Be aware of implications when working in shared branches.

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

4. **Deploy the files** and push to your repository

## Customization ⚙️

The main script in `.github/scripts/enhance-commits.js` can be customized:

- Adjust `MAX_DIFF_SIZE` and sampling parameters
- Change the AI model (default: `gemini-2.5-flash-preview-04-17` - note this is a preview model that will require updating as Google releases new models)
- Customize the AI provider by modifying the API endpoint - you can replace Gemini with ChatGPT, Ollama, or other AI services by updating the API integration code
- Modify the prompt templates for your specific project needs
- Add your project context to improve AI understanding

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
  'manifest.json': 'Extension Manifest'
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

You can adapt the code to work with:
- OpenAI's ChatGPT models
- Local models via Ollama
- Other commercial or open-source LLM providers

## Security Considerations 🔒

- **Force Pushing**: This action uses `git push --force` - use carefully in shared branches
- **Token Security**: Keep API keys and PATs secure using GitHub Secrets
- **API Costs**: Monitor Gemini API usage to avoid unexpected charges
- **Large Commits**: Very large changes may be truncated before sending to the API

## Troubleshooting 🛠️

- Check action logs for specific error messages
- Verify secret names and permissions
- Validate API keys are active and correct
- Consider breaking down large commits if exceeding size limits

## License 📄

[MIT License](LICENSE)

---

Made with ❤️ for developers who care about commit quality
