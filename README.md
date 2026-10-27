# Media Camera

A small purple camera at the right end of a note's row in the file explorer when the note has a photo, video or other
media in it, and on every folder above that note, up to the top folder, so you can follow the cameras down to it
even when the folders are closed.

A note gets the camera when it shows (embeds) any of these:

- a photo: `![[beach.png]]` or `![](Photos/beach.png)` (png, jpg, gif, webp, svg, heic, and the other image types)
- a video or sound file: `![[clip.mp4]]`, `![[memo.m4a]]`
- a picture from the web: `![](https://…/cat.jpg)` or an `<img>` / `<video>` / `<audio>` tag

A plain link (`[[beach.png]]` without the `!`), an embedded PDF and an embedded note don't count. The camera comes
and goes as soon as you add or remove media in the note.

## Colour

Set in `styles.css` (same purple family as Folder Stats and Folder Merger); a CSS snippet can override it:

```
body {
	--media-camera-color: #7c3aed;
}
```

## Install by hand

Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/media-camera/`, then turn it on
under Settings, Community plugins.

## Build

```
npm install
npm run build
```
