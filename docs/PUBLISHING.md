# GitHub publishing checklist

## Required before a public release

- Choose a repository license for the application code and skills.
- Confirm that `.paper-daily/` and `public/local/` are absent from the Git index and history.
- Create the GitHub repository, add its URL as `origin`, and fill in the description, website URL, and topics.
- Decide whether `.openai/hosting.json` should retain the current Sites project or use a fresh project.
- Enable branch protection for `main` and require the `CI / verify` check.
- Enable Dependabot alerts, secret scanning, and private vulnerability reporting.

## Release check

1. Run `npm ci` and all verification commands from a clean clone.
2. Initialize a disposable local profile and verify the empty, recommended, reading, and feedback states.
3. Confirm no user profile, article, paper PDF, source archive, or paper image is tracked.
4. Test the deployed reading API with two users to confirm isolation.
5. Tag the first stable snapshot only after the deployed recommendation loop has been exercised end to end.

GitHub Pages alone cannot host the reading API and D1-backed persistence. Use the configured Sites/Cloudflare runtime or another compatible server deployment.
