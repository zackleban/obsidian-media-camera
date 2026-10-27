"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MediaCameraPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var ROW = ".nav-file-title[data-path], .nav-folder-title[data-path]";
var ICON_CLASS = "media-camera-icon";
var MEDIA = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "svg",
  "webp",
  "avif",
  "heic",
  "tif",
  "tiff",
  "mp4",
  "webm",
  "mov",
  "mkv",
  "ogv",
  "3gp",
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "flac",
  "aac"
]);
var WEB_IMAGE = /!\[[^\]]*\]\(\s*<?https?:\/\/|<(?:img|video|audio)\s[^>]*src=/i;
var MediaCameraPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    // True or false per note path, thrown away when that note (or any file) changes.
    this.cache = /* @__PURE__ */ new Map();
    // Every folder holding a note with media, worked out again after any change.
    this.folders = null;
    this.observers = [];
    this.queued = false;
  }
  onload() {
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        this.cache.delete(file.path);
        this.folders = null;
        this.queue();
      })
    );
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
  watch() {
    this.observers.forEach((o) => o.disconnect());
    this.observers = [];
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const observer = new MutationObserver(() => this.queue());
      observer.observe(leaf.view.containerEl, { childList: true, subtree: true });
      this.observers.push(observer);
    }
    this.queue();
  }
  queue() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.paint();
    });
  }
  paint() {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      leaf.view.containerEl.querySelectorAll(ROW).forEach((row) => this.mark(row));
    }
  }
  mark(row) {
    const file = this.app.vault.getAbstractFileByPath(row.dataset.path ?? "");
    const want = file instanceof import_obsidian.TFolder ? this.mediaFolders().has(file.path) : file instanceof import_obsidian.TFile && file.extension === "md" && this.hasMedia(file);
    const icon = row.querySelector(`:scope > .${ICON_CLASS}`);
    if (want && !icon) {
      const label = file instanceof import_obsidian.TFolder ? "A note inside has a photo or media" : "Has a photo or media";
      const camera = row.createSpan({ cls: ICON_CLASS, attr: { "aria-label": label } });
      (0, import_obsidian.setIcon)(camera, "camera");
    } else if (!want && icon) icon.remove();
  }
  mediaFolders() {
    if (this.folders) return this.folders;
    const folders = /* @__PURE__ */ new Set();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!this.hasMedia(file)) continue;
      for (let f = file.parent; f && !f.isRoot() && !folders.has(f.path); f = f.parent) folders.add(f.path);
    }
    return this.folders = folders;
  }
  hasMedia(file) {
    const known = this.cache.get(file.path);
    if (known !== void 0) return known;
    let found = false;
    for (const embed of this.app.metadataCache.getFileCache(file)?.embeds ?? []) {
      const target = this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian.getLinkpath)(embed.link), file.path);
      const ext = (target?.extension ?? (0, import_obsidian.getLinkpath)(embed.link).split(".").pop() ?? "").toLowerCase();
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
  async checkText(file) {
    const text = await this.app.vault.cachedRead(file);
    if (!WEB_IMAGE.test(text) || this.cache.get(file.path) !== false) return;
    this.cache.set(file.path, true);
    this.folders = null;
    this.queue();
  }
};
