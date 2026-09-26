/* ============================================================
   site.js: the only script on the site
   1. Light / dark toggle, remembered per visitor
   2. Experience: fold the details in the columns behind buttons
   3. Experience: build the timeline view from the same entries,
      and switch between the two views
   4. Publications: journal / conference filter
   5. Videos: load the YouTube player only when asked
   6. Diagrams: inline the SVGs so they take the page's colours
   7. Pictures: click one to see it large
   Without it the page still works: the theme follows the system,
   and the columns show every entry in full.
   ============================================================ */

function remember(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (e) {
		/* Storage blocked: the choice lasts for this page view only. */
	}
}

function recall(key) {
	try {
		return localStorage.getItem(key);
	} catch (e) {
		return null;
	}
}

/* ── 1. Theme toggle ───────────────────────────────────────── */
(function () {
	const button = document.querySelector(".theme-toggle");
	if (!button) return;

	const root = document.documentElement;
	const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

	button.addEventListener("click", function () {
		const current = root.dataset.theme || (systemDark.matches ? "dark" : "light");
		const next = current === "dark" ? "light" : "dark";
		root.dataset.theme = next;
		remember("theme", next);
	});
})();

/* ── 2. Column details ─────────────────────────────────────── */
(function () {
	document.querySelectorAll("#exp-columns .ent").forEach(function (entry) {
		const points = entry.querySelector(".pts");
		if (!points) return;

		points.id = entry.id + "-pts";
		points.hidden = true;

		const button = document.createElement("button");
		button.type = "button";
		button.className = "more";
		button.textContent = "Details";
		button.setAttribute("aria-expanded", "false");
		button.setAttribute("aria-controls", points.id);
		button.addEventListener("click", function () {
			const open = button.getAttribute("aria-expanded") !== "true";
			button.setAttribute("aria-expanded", String(open));
			points.hidden = !open;
		});
		entry.insertBefore(button, points);
	});
})();

/* ── 3. Timeline and view switch ───────────────────────────── */
(function () {
	const columns = document.getElementById("exp-columns");
	const view = document.getElementById("exp-timeline");
	const timeline = document.getElementById("timeline");
	const detail = document.getElementById("timeline-detail");
	if (!columns || !view) return;

	const LANES = [
		["work", "Industry & Research"],
		["education", "Education"],
		["community", "Teaching & community"],
	];

	// "2025-04" becomes 2025.25.
	function year(text) {
		const [y, m] = text.split("-").map(Number);
		return y + ((m || 1) - 1) / 12;
	}

	const today = new Date();
	const now = today.getFullYear() + today.getMonth() / 12;

	// Everything the timeline draws, read from the page: a role, or a
	// whole organisation when the data-lane sits on it.
	const items = [];
	columns.querySelectorAll("[data-lane]").forEach(function (el) {
		const d = el.dataset;
		const start = year(d.start);
		const end = d.end ? year(d.end) + 1 / 12 : now;
		items.push({
			id: el.id,
			lane: d.lane,
			label: d.label,
			start: start,
			end: end,
			pin: "short" in d,
			at: (start + end) / 2,
			el: el,
		});
	});

	const last = Math.floor(now) + 1;
	const first = Math.floor(Math.min.apply(null, items.map(function (i) { return i.start; })));
	let range = "all";
	let selected = items[0].id;

	function pct(y, from, to) {
		return (((y - from) / (to - from)) * 100).toFixed(2);
	}

	function draw() {
		const from = range === "all" ? first : last - 10;
		const to = last;
		const step = to - from > 10 ? 2 : 1;
		timeline.textContent = "";

		LANES.forEach(function ([lane, name]) {
			const row = document.createElement("div");
			row.className = "lane";
			row.innerHTML = "<span></span><div class=\"track\"></div>";
			row.firstChild.textContent = name;
			const track = row.lastChild;
			track.style.setProperty("--c", "var(--lane-" + lane + ")");

			items
				.filter(function (i) { return i.lane === lane && i.end >= from; })
				.forEach(function (i) {
					const b = document.createElement("button");
					b.type = "button";
					b.setAttribute("aria-pressed", String(i.id === selected));
					if (i.pin) {
						b.className = "pin";
						b.style.setProperty("--s", pct(i.at, from, to));
						b.setAttribute("aria-label", i.label);
						const label = document.createElement("span");
						label.className = "pin-label";
						label.style.setProperty("--s", pct(i.at, from, to));
						// The label sits right of the pin, unless a bar starts close
						// enough after it to cover the text: then it goes left.
						const crowded = items.some(function (o) {
							return o.lane === lane && !o.pin && o.start > i.at &&
								pct(o.start, from, to) - pct(i.at, from, to) < 15;
						});
						if (crowded) label.classList.add("left");
						label.textContent = i.label;
						track.append(b, label);
					} else {
						b.className = i.start < from ? "bar clipped" : "bar";
						b.style.setProperty("--s", pct(Math.max(i.start, from), from, to));
						b.style.setProperty("--e", pct(i.end, from, to));
						b.innerHTML = "<span></span>";
						b.firstChild.textContent = i.label;
						track.append(b);
					}
					b.addEventListener("click", function () {
						selected = i.id;
						draw();
					});
				});
			timeline.append(row);
		});

		const axis = document.createElement("div");
		axis.className = "axis";
		for (let y = Math.ceil(from / step) * step; y <= to; y += step) {
			const tick = document.createElement("span");
			if (y === to) tick.className = "end";
			tick.style.setProperty("--s", pct(y, from, to));
			tick.textContent = y;
			axis.append(tick);
		}
		timeline.append(axis);

		showDetail(items.find(function (i) { return i.id === selected; }));
	}

	// The panel below the timeline repeats the selected content: one role
	// with its organisation, or an organisation with all its roles.
	function showDetail(item) {
		const org = item.el.closest(".org");
		const orgName = org.querySelector("h4").textContent;
		detail.textContent = "";
		const head = document.createElement("div");
		const body = document.createElement("div");
		const title = document.createElement("h3");

		function when(text) {
			const p = document.createElement("p");
			p.className = "when";
			p.textContent = text;
			return p;
		}

		if (item.el === org) {
			title.textContent = orgName;
			head.append(when(org.querySelector(".org-meta").textContent), title);
			const roles = org.querySelector(".roles").cloneNode(true);
			roles.querySelectorAll(".more").forEach(function (b) { b.remove(); });
			roles.querySelectorAll("[id]").forEach(function (e) { e.removeAttribute("id"); });
			roles.querySelectorAll(".pts").forEach(function (e) { e.hidden = false; });
			body.append(roles);
		} else {
			title.textContent = item.el.querySelector("h5").textContent;
			const at = document.createElement("p");
			at.className = "org-meta";
			at.textContent = orgName;
			head.append(item.el.querySelector(".when").cloneNode(true), title, at);
			const sup = item.el.querySelector(".sup");
			if (sup) head.append(sup.cloneNode(true));
			const points = item.el.querySelector(".pts").cloneNode(true);
			points.removeAttribute("id");
			points.hidden = false;
			body.append(points);
		}
		detail.append(head, body);
	}

	view.querySelectorAll("[data-range]").forEach(function (button) {
		button.addEventListener("click", function () {
			range = button.dataset.range;
			view.querySelectorAll("[data-range]").forEach(function (b) {
				b.setAttribute("aria-pressed", String(b === button));
			});
			draw();
		});
	});

	// Columns first, unless the visitor chose the timeline before.
	const switches = document.querySelectorAll(".view-switch [data-view]");
	function show(which) {
		columns.hidden = which !== "columns";
		view.hidden = which !== "timeline";
		switches.forEach(function (b) {
			b.setAttribute("aria-pressed", String(b.dataset.view === which));
		});
	}
	switches.forEach(function (button) {
		button.addEventListener("click", function () {
			show(button.dataset.view);
			remember("experience-view", button.dataset.view);
		});
	});

	draw();
	show(recall("experience-view") === "timeline" ? "timeline" : "columns");
})();

/* ── 4. Publication filter ─────────────────────────────────── */
(function () {
	const buttons = document.querySelectorAll(".pub-filter [data-filter]");
	const papers = document.querySelectorAll(".pubs .pub");

	buttons.forEach(function (button) {
		button.addEventListener("click", function () {
			const kind = button.dataset.filter;
			buttons.forEach(function (b) {
				b.setAttribute("aria-pressed", String(b === button));
			});
			papers.forEach(function (paper) {
				paper.hidden = kind !== "all" && paper.dataset.kind !== kind;
			});
		});
	});
})();

/* ── 5. Videos ─────────────────────────────────────────────── */
// The poster is a plain link to YouTube. On click it becomes the player,
// from YouTube's privacy-enhanced domain, so nothing is loaded from
// YouTube until the visitor asks for the video.
(function () {
	document.querySelectorAll("a[data-youtube]").forEach(function (link) {
		link.addEventListener("click", function (event) {
			event.preventDefault();
			const frame = document.createElement("iframe");
			frame.src = "https://www.youtube-nocookie.com/embed/" + link.dataset.youtube + "?autoplay=1&rel=0";
			frame.title = link.getAttribute("aria-label").replace(/^Play the video: /, "");
			frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
			frame.allowFullscreen = true;
			link.replaceWith(frame);
			frame.focus();
		});
	});
})();

/* ── 6. Diagrams ───────────────────────────────────────────── */
// Each diagram is an SVG file whose colours are the page's CSS tokens,
// with light-theme fallbacks. As an <img> it can only use the fallbacks,
// so it is swapped for the SVG itself, which then follows the theme.
(function () {
	document.querySelectorAll("img[data-inline-svg]").forEach(function (img) {
		fetch(img.src)
			.then(function (response) {
				return response.ok ? response.text() : Promise.reject(response.status);
			})
			.then(function (text) {
				const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
				if (svg.nodeName !== "svg") return;
				img.replaceWith(document.importNode(svg, true));
			})
			.catch(function () {
				/* Keep the <img>: it still shows, in the light colours. */
			});
	});
})();

/* ── 7. Pictures open large ────────────────────────────────── */
// Any picture or diagram in Projects or Publications opens in a dialog,
// whole and uncropped. Videos keep their own click (section 5).
(function () {
	const pictures = document.querySelectorAll("#projects .media:not(.video), #publications .media:not(.video)");
	if (!pictures.length || typeof HTMLDialogElement !== "function") return;

	const dialog = document.createElement("dialog");
	dialog.className = "lightbox";
	dialog.innerHTML =
		'<button type="button" class="lightbox-close" aria-label="Close">\u00d7</button>' +
		'<div class="lightbox-body"></div><p class="lightbox-caption"></p>';
	document.body.append(dialog);
	const body = dialog.querySelector(".lightbox-body");
	const caption = dialog.querySelector(".lightbox-caption");

	function describe(media) {
		const el = media.querySelector("svg, img");
		return el ? el.getAttribute("aria-label") || el.getAttribute("alt") || "" : "";
	}

	function open(media) {
		const el = media.querySelector("svg, img");
		if (!el) return;
		body.textContent = "";
		body.className = "lightbox-body" + (media.classList.contains("diagram") ? " is-diagram" : "");
		const copy = el.cloneNode(true);
		copy.removeAttribute("loading");
		body.append(copy);
		caption.textContent = describe(media);
		dialog.showModal();
	}

	pictures.forEach(function (media) {
		media.tabIndex = 0;
		media.setAttribute("role", "button");
		media.setAttribute("aria-label", "Enlarge: " + describe(media));
		media.addEventListener("click", function () { open(media); });
		media.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				open(media);
			}
		});
	});

	dialog.querySelector(".lightbox-close").addEventListener("click", function () { dialog.close(); });
	// A click on the dimmed backdrop lands on the dialog itself.
	dialog.addEventListener("click", function (event) {
		if (event.target === dialog) dialog.close();
	});
})();
