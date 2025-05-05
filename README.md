# Commit Message Enhancer 🚀

> 💡 Automatically generate detailed, consistent commit messages and PR descriptions using Google's Gemini AI

This GitHub Action transforms basic commit messages into comprehensive, contextual descriptions by analyzing your code changes. Say goodbye to cryptic commit histories and hello to clear, professional documentation of your development process.

## How It Works 🔄

When triggered by pushes or PR events, the action:

1. Extracts code changes (diff) from commits or PRs
2. Sends the original message and diff to Gemini API
3. Generates a detailed enhancement based on your code context
4. Updates the commit message or PR description automatically

**Key Feature:** Modifies Git history by amending commits and force-pushing. Be aware of implications when working in shared branches.

## Example Commit

![image](https://github.com/user-attachments/assets/26d057f2-03bb-44f5-9378-c82cf5d04eee)
[Source](https://github.com/steveseguin/social_stream/commit/78317940c7c4096f81f4bdffbacd672a8feeddf7)

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
   - **GitHub PAT**: Create with `repo` and `workflow` scopes

3. **Add Repository Secrets**:
   - Add `GEMINI_API_KEY` and `COMMIT_ENHANCER_PAT` in your repo settings

4. **Deploy the files** and push to your repository

## Customization ⚙️

The main script in `.github/scripts/enhance-commits.js` can be customized:

- Adjust `MAX_DIFF_SIZE` and sampling parameters
- Change the Gemini model (default: `gemini-2.5-flash-preview-04-17`)
- Modify the prompt templates for your specific project needs
- Add your project context to improve AI understanding

### Custom Repository Context

The script provides robust repository context to Gemini:

```javascript
**Project Context: Your Project Name**

* **Purpose:** What your project does
* **Core Features:** Key features of your project
* **Key Components:** Important files/directories
* **Technology Stack:** Languages and technologies used
```

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
