# codesign --force --deep --sign - release/mac-arm64/files-ai.app
hdiutil create -volname "files-ai" -srcfolder release/mac-arm64/files-ai.app -ov -format UDZO files-ai.dmg