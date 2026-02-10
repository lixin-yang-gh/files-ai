## This is an open-source desktop app designed to help users reference multiple files — including their relative paths and full content — in order to generate well-structured prompts for large language models.

- Especially well-suited for models that support very long context lengths.
- Each referenced file includes both its relative path and complete content. Providing relative paths gives the model a clear understanding of the project’s file and folder hierarchy — particularly valuable for complex coding or writing projects.
- There are currently no plans to release pre-built Linux binaries. However, building for Linux is straightforward — see the instructions in package.json.
- I’m considering adding web search functionality to the app, which would allow the generated prompts to include RAG-like (retrieval-augmented) external information.
Before proceeding, I’d like to better understand whether there is genuine demand for this feature.

--- 
## Using the app on MacOS

The app installed from the downloaded .dmg file will be blocked by the MacOS by default. As I am not willing to pay for an Apple Developer Account in near term, please run the following comman to remove the quarantine against the app.

```bash
xattr -rd com.apple.quarantine /Applications/files-ai.app
```

---

<img width="1626" height="1394" alt="image" src="https://github.com/user-attachments/assets/691cc27f-047d-4ee5-9cb8-52afb9da1eec" />





