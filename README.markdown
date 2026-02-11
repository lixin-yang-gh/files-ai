### This is an open-source desktop app designed to help users reference multiple files — including their relative paths and full content — in order to generate well-structured prompts for large language models.

- Especially well-suited for models that support very long context lengths.
- Each referenced file includes both its relative path and complete content. Providing relative paths gives the model a clear understanding of the project’s file and folder hierarchy — particularly valuable for complex coding or writing projects.
- There are currently no plans to release pre-built Linux binaries. However, building for Linux is straightforward — see the instructions in package.json.
- I’m considering adding web search functionality to the app, which would allow the generated prompts to include RAG-like (retrieval-augmented) external information.
Before proceeding, I’d like to better understand whether there is genuine demand for this feature.

--- 

### Installing the app on Windows 

Windows will show you warning when you start the installer as the app has not been signed properly. Please just ignore the warning and install the app anyway.

--- 

### Using the app on macOS

The app installed from the downloaded .dmg file will be blocked by the macOS by default. As I am not willing to pay for an Apple Developer Account in near term, please run the following command in your terminal window to remove the quarantine against the app.

```bash
xattr -rd com.apple.quarantine /Applications/files-ai.app
```
