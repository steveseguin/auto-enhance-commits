# Commit Message Enhancer

[![GitHub Actions Status](https://github.com/<YOUR_USERNAME>/<YOUR_REPO>/actions/workflows/enhance-commits.yml/badge.svg)](https://github.com/<YOUR_USERNAME>/<YOUR_REPO>/actions/workflows/enhance-commits.yml) This GitHub Action automatically enhances your commit messages and pull request descriptions using Google's Gemini API. It aims to create more descriptive and consistent commit histories and clearer pull requests based on the code changes.

## How It Works

When triggered (by pushes to main/master or PR events), the action performs the following steps:

1.  **Checks out code:** Fetches the latest commit(s).
2.  **Extracts changes:** Gets the diff of the relevant commit or pull request.
3.  **Calls Gemini API:** Sends the original commit message (or PR description) and the code diff to the Google Gemini API.
4.  **Generates Enhancement:** Gemini processes the input and generates an improved message/description based on the prompts defined in the script.
5.  **Updates Commit/PR:**
    * For commits: Amends the latest commit with the enhanced message using `git commit --amend` and **force-pushes** the change.
    * For pull requests: Updates the pull request description via the GitHub API.

**Key Feature:** This action modifies your Git history by amending commits and force-pushing. Be aware of the implications, especially when working in shared branches.

## Prerequisites

* A GitHub repository where you want to use this action.
* Access to Google AI Studio (or Google Cloud) to generate a Gemini API key.

## Setup and Deployment

Follow these steps to deploy the Commit Message Enhancer in your repository:

1.  **Create Directory Structure:**
    Ensure you have the following directory structure in your repository:
    ```
    .github/
    ├── workflows/
    │   └── enhance-commits.yml
    └── scripts/
        └── enhance-commits.js
    ```

2.  **Add Action Files:**
    Copy the provided `enhance-commits.yml` file into `.github/workflows/` and the `enhance-commits.js` file into `.github/scripts/`.

3.  **Generate Gemini API Key:**
    * Go to [Google AI Studio](https://makersuite.google.com/) or your Google Cloud project.
    * Create a new API key for the Gemini API.

4.  **Generate Personal Access Token (PAT):**
    This action requires a GitHub Personal Access Token (PAT) instead of the default `GITHUB_TOKEN`. This is necessary for two main reasons:
    * To allow the push made by the action (after amending the commit) to trigger other workflows if needed. The default `GITHUB_TOKEN` prevents this to avoid infinite loops.
    * To ensure the action has sufficient permissions to write contents (amend commit, push) and update pull requests.
    * **Steps to create PAT:**
        * Go to your GitHub Settings -> Developer settings -> Personal access tokens -> Tokens (classic) or Fine-grained tokens.
        * Click "Generate new token".
        * Give it a descriptive name (e.g., `commit-enhancer-action-token`).
        * Set an expiration date.
        * **Select Scopes:** Grant the token the necessary permissions. For this action, you typically need:
            * `repo` (Full control of private repositories) - This usually covers contents and pull requests.
            * `workflow` (Update GitHub Action workflows) - Recommended if you want pushes from this action to trigger other workflows.
        * Click "Generate token" and **copy the token immediately**. You won't see it again.

5.  **Add Repository Secrets:**
    Store your API key and PAT securely as GitHub Actions secrets:
    * Go to your repository on GitHub.
    * Navigate to `Settings` > `Secrets and variables` > `Actions`.
    * Click "New repository secret" for each secret:
        * **Secret 1:**
            * Name: `GEMINI_API_KEY`
            * Value: Paste your Gemini API key.
        * **Secret 2:**
            * Name: `COMMIT_ENHANCER_PAT`
            * Value: Paste your generated Personal Access Token (PAT).

6.  **Commit and Push:**
    Commit the `.github/workflows/enhance-commits.yml` and `.github/scripts/enhance-commits.js` files to your repository and push them.

The action will now run on subsequent pushes to `main`/`master` or when pull requests are opened or updated.

## Configuration and Customization

The core logic and prompts reside in `.github/scripts/enhance-commits.js`. You will likely need to customize this script for your specific needs:

* **Configuration Variables:** At the top of the script, you can adjust:
    * `MAX_DIFF_SIZE`: Controls the maximum number of characters from the diff sent to the API.
    * `MAX_FILES_TO_SAMPLE`: Limits how many changed files are included in the diff context.
    * `SAMPLE_LINES_PER_FILE`: Limits the lines sampled from each file's diff.
* **Gemini Model:** You can change the specific Gemini model used (e.g., `gemini-pro`, `gemini-1.5-flash-latest`) by updating the `model` variable initialization, depending on your needs for cost, speed, and capability. Remember that model availability and naming might change. Check the [Google AI documentation](https://ai.google.dev/models/gemini) for current models.
* **Prompts:** **This is the most important customization area.** The prompts within the `enhanceCommitMessage` and `updatePRDescription` functions dictate how Gemini rewrites your messages.
    * **Tailor the Instructions:** Modify the instructions within the prompt template strings to guide the AI. You might want to:
        * Specify a different tone (e.g., more casual, stricter).
        * Require specific formatting (e.g., Conventional Commits).
        * Ask it to reference issue numbers if they appear in the branch name or original message.
        * **Add Repository Context:** Include details about your project, its main purpose, or common terminology to help the AI generate more relevant summaries. *(This is where you'd add things like a "summary of the repo" context for the AI).*
        * **File Mappings/Importance:** If certain file names or patterns are particularly important (e.g., `package.json`, `schema.rb`, specific configuration files), you could potentially modify the script to extract these filenames specifically and instruct the AI within the prompt to pay special attention to changes in them. *(This addresses the "mapped file names" concept).*

## Important Considerations

* **Force Pushing:** This action **force-pushes** (`git push --force`) after amending commits. This rewrites history and can be disruptive if others are working on the same branch. It's generally safer on feature branches before merging or if you are the sole contributor to the branch being pushed to.
* **Token Security:** Keep your `GEMINI_API_KEY` and `COMMIT_ENHANCER_PAT` secure. Do not expose them directly in your code. Use GitHub Secrets. Revoke tokens if compromised.
* **API Costs:** Using the Gemini API may incur costs depending on your usage volume. Monitor your usage in your Google Cloud Console or AI Studio dashboard.
* **AI Accuracy:** The enhanced messages are generated by an AI. While often helpful, they may not always be perfect or capture the full nuance of a change. Review the generated messages.
* **Commit Size:** Very large commits might exceed the configured `MAX_DIFF_SIZE` or API limits, resulting in truncated diffs being sent to the AI and potentially less accurate summaries.

## Troubleshooting

If the action fails or behaves unexpectedly:

1.  **Check Action Logs:** Go to the "Actions" tab in your GitHub repository and examine the logs for the failed run for specific error messages.
2.  **Verify Secrets:** Ensure `GEMINI_API_KEY` and `COMMIT_ENHANCER_PAT` are correctly named and populated in your repository's Actions secrets.
3.  **Check PAT Permissions:** Confirm your Personal Access Token has the required scopes (`repo`, `workflow`) and hasn't expired.
4.  **Validate API Key:** Ensure your Gemini API key is valid and active. Check your Google AI Studio or Cloud Console.
5.  **Script Errors:** Look for JavaScript errors in the action logs, possibly originating from `enhance-commits.js`.
6.  **Diff Size:** If commits are very large, consider adjusting the configuration variables in the script or breaking down changes into smaller commits.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[Specify your license here, e.g., MIT License]
