# Import a Notion export

## Recommended export

In Notion on desktop or web:

1. Open the page that contains your essays or writing database.
2. Select the `•••` menu, then **Export**.
3. Choose **Markdown & CSV**.
4. Enable **Include subpages**.
5. Download the ZIP and leave it zipped.

For a whole workspace, use **Settings → General → Export all workspace content**. Large exports may contain material unrelated to personal stories, so a focused parent page usually produces a cleaner vault. See [Notion’s current export documentation](https://www.notion.com/help/export-your-content).

## Import

```bash
story-vault import ~/Downloads/Export.zip --vault ~/Documents/my-story-vault
```

Directories and individual supported documents also work. The importer recursively reads Markdown, text, HTML, and CSV while ignoring attachments and hidden files.

## Re-importing

The document ID combines its title with a hash of its relative source path. Importing the same export again updates changed source text without duplicating it and preserves existing `stories` backlinks.

If a page moves to a different source path, it receives a new ID. Review and remove the older Markdown record manually after confirming it is no longer linked.

## What is not imported

- Images, PDFs, videos, and arbitrary attachments
- Notion comments
- Remote pages that were not present in the export
- Files with almost no readable content

HTML is converted to readable plain text. Markdown exports preserve the richest structure and are preferred.
