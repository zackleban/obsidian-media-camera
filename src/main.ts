import { Plugin, TFile, TFolder, getLinkpath, setIcon } from "obsidian";

// Note rows and folder rows; a folder gets the camera when any note inside it, however deep, has media.
const ROW = ".nav-file-title[data-path], .nav-folder-title[data-path]";
const ICON_CLASS = "media-camera-icon";
// Photos, video and sound: what Obsidian itself can show inside a note.
const MEDIA = new Set([
	"png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif", "heic", "tif", "tiff",
	"mp4", "webm", "mov", "mkv", "ogv", "3gp",
	"mp3", "wav", "m4a", "ogg", "flac", "aac",
]);
// An image from the web written into the note: ![alt](https://…) or <img src="…">.
const WEB_IMAGE = /!\[[^\]]*\]\(\s*<?https?:\/\/|<(?:img|video|audio)\s[^>]*src=/i;

export default class MediaCameraPlugin extends Plugin {
	// True or false per note path, thrown away when that note (or any file) changes.
	private cache = new Map<string, boolean>();
	// Every folder holding a note with media, worked out again after any change.
	private folders: Set<string> | null = null;
	private observers: MutationObserver[] = [];
	private queued = false;

	onload() {
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				this.cache.delete(file.path);
				this.folders = null;
				this.queue();
			}),
		);
		// A photo added, removed or renamed can change what a note's embeds point to.
		const clear = () => {
			this.cache.clear();
			this.folders = null;
			this.queue();
		};
		this.registerEvent(this.app.vault.on("create", clear));
		this.registerEvent(this.app.vault.on("delete", clear));
		this.registerEvent(this.app.vault.on("rename", clear));
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.queue()));

		this.app.workspace.onLayoutReady(() => this.watch());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.watch()));
	}

	onunload() {
		this.observers.forEach((o) => o.disconnect());
		document.querySelectorAll(`.${ICON_CLASS}`).forEach((el) => el.remove());
	}

	// The explorer draws rows as you scroll and open folders, so new rows get their camera as they appear.
	private watch() {
		this.observers.forEach((o) => o.disconnect());
		this.observers = [];
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			const observer = new MutationObserver(() => this.queue());
			observer.observe(leaf.view.containerEl, { childList: true, subtree: true });
			this.observers.push(observer);
		}
		this.queue();
	}

	private queue() {
		if (this.queued) return;
		this.queued = true;
		requestAnimationFrame(() => {
			this.queued = false;
			this.paint();
		});
	}

	private paint() {
		for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
			leaf.view.containerEl.querySelectorAll<HTMLElement>(ROW).forEach((row) => this.mark(row));
		}
	}

	private mark(row: HTMLElement) {
		const file = this.app.vault.getAbstractFileByPath(row.dataset.path ?? "");
		const want =
			file instanceof TFolder
				? this.mediaFolders().has(file.path)
				: file instanceof TFile && file.extension === "md" && this.hasMedia(file);
		const icon = row.querySelector(`:scope > .${ICON_CLASS}`);
		if (want && !icon) {
			const label = file instanceof TFolder ? "A note inside has a photo or media" : "Has a photo or media";
			const camera = row.createSpan({ cls: ICON_CLASS, attr: { "aria-label": label } });
			setIcon(camera, "camera");
		} else if (!want && icon) icon.remove();
	}

	private mediaFolders(): Set<string> {
		if (this.folders) return this.folders;
		const folders = new Set<string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!this.hasMedia(file)) continue;
			for (let f = file.parent; f && !f.isRoot() && !folders.has(f.path); f = f.parent) folders.add(f.path);
		}
		return (this.folders = folders);
	}

	private hasMedia(file: TFile): boolean {
		const known = this.cache.get(file.path);
		if (known !== undefined) return known;
		let found = false;
		for (const embed of this.app.metadataCache.getFileCache(file)?.embeds ?? []) {
			const target = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(embed.link), file.path);
			const ext = (target?.extension ?? getLinkpath(embed.link).split(".").pop() ?? "").toLowerCase();
			if (MEDIA.has(ext) || WEB_IMAGE.test(embed.original)) {
				found = true;
				break;
			}
		}
		if (!found) this.checkText(file);
		this.cache.set(file.path, found);
		return found;
	}

	// Web images aren't in Obsidian's list of embeds, so look for them in the note's text once, in the background.
	private async checkText(file: TFile) {
		const text = await this.app.vault.cachedRead(file);
		if (!WEB_IMAGE.test(text) || this.cache.get(file.path) !== false) return;
		this.cache.set(file.path, true);
		this.folders = null;
		this.queue();
	}
}
