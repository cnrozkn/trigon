Review all uncommitted changes in the working tree.

Steps:
1. Run `git diff` to see unstaged changes and `git diff --cached` to see staged changes
2. Review every change for:
   - Security issues (XSS, injection, OWASP top 10)
   - Performance concerns (especially in PlayScene.js hot paths)
   - Phaser 3 best practices and correct API usage
   - Consistency with existing code style and conventions in CLAUDE.md
   - Potential bugs or logic errors
3. Provide a concise summary of findings with file:line references
4. If no issues found, confirm the changes look good

If arguments are provided, focus the review on those specific areas: $ARGUMENTS
