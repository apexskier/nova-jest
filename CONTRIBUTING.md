# Contributing

## Development

### Running locally

Clone this project, and open it in Nova. Run the Development task to build scripts and auto-rebuild on file changes.

Turn on extension development in Nova in Preferences > General > Extension Development. I've you've installed the extension from the Extension Library, disable it, then activate the local one with Extensions > Activate Project as Extension.

### Debugging

Use the Extension Console in Nova to debug the extension. I haven't found a way to get a debugger attached to the JavaScriptCore context.

## Publishing notes

Run `yarn build` first.
