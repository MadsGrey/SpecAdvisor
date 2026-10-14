/* =========================================================
   GLOBAL DIALOGS
   Replaces the browser's "127.0.0.1:5500 says" alert/confirm.

   Usage (in any page script):
       import { appAlert, appConfirm } from "./ui-dialog.js";

       await appAlert("Saved!", { type: "success" });

       const ok = await appConfirm("Delete this?", {
           title: "Delete User",
           confirmText: "Delete",
           danger: true
       });
       if (!ok) return;
========================================================= */

const STYLE_ID = "ud-style";

const COLORS = {
    info: "#3b8ea5",
    success: "#2e8b57",
    warning: "#d98a00",
    error: "#c0392b",
    question: "#244b5a"
};

const ICONS = {
    info: "i",
    success: "✓",
    warning: "!",
    error: "✕",
    question: "?"
};

const TITLES = {
    info: "Notice",
    success: "Success",
    warning: "Warning",
    error: "Error",
    question: "Please Confirm"
};

const queue = [];
let showing = false;

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
        .ud-overlay {
            position: fixed; inset: 0; z-index: 100003;
            display: flex; align-items: center; justify-content: center;
            padding: 16px; background: rgba(20, 40, 48, .55);
            animation: ud-fade .15s ease;
        }
        .ud-box {
            width: 100%; max-width: 420px; padding: 28px 26px 22px;
            background: #fff; border-radius: 16px; text-align: center;
            box-shadow: 0 20px 50px rgba(0, 0, 0, .25);
            animation: ud-pop .18s ease; font-family: inherit;
        }
        .ud-icon {
            width: 54px; height: 54px; margin: 0 auto 14px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%; color: #fff; font-size: 26px; font-weight: 700;
        }
        .ud-title { margin: 0 0 8px; font-size: 19px; color: #244b5a; }
        .ud-message {
            margin: 0 0 22px; color: #51676f; font-size: 15px;
            line-height: 1.55; white-space: pre-line; word-break: break-word;
            max-height: 50vh; overflow: auto;
        }
        .ud-actions {
            display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
        }
        .ud-btn {
            min-width: 100px; padding: 11px 22px; border: 0;
            border-radius: 10px; font-size: 14px; font-weight: 700;
            cursor: pointer; font-family: inherit;
        }
        .ud-btn-primary { background: #244b5a; color: #fff; }
        .ud-btn-danger { background: #c0392b; color: #fff; }
        .ud-btn-secondary { background: #eef3f5; color: #334c55; }
        .ud-btn:disabled { opacity: .45; cursor: not-allowed; }
        .ud-agree {
            display: flex; align-items: flex-start; gap: 10px;
            margin: 0 0 20px; padding: 12px 14px; text-align: left;
            background: #f1f7f9; border: 1px solid #dbe8ec;
            border-radius: 10px; color: #334c55; font-size: 14px;
            line-height: 1.45; cursor: pointer;
        }
        .ud-agree input {
            margin-top: 2px; width: 17px; height: 17px;
            accent-color: #244b5a; flex-shrink: 0;
        }
        .ud-btn:focus-visible { outline: 3px solid #8ec6d1; outline-offset: 2px; }
        @keyframes ud-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ud-pop {
            from { opacity: 0; transform: scale(.92); }
            to { opacity: 1; transform: scale(1); }
        }
    `;

    document.head.appendChild(style);
}

function openDialog(config) {
    return new Promise(resolve => {
        queue.push({ ...config, resolve });
        showNext();
    });
}

function showNext() {
    if (showing || queue.length === 0) return;

    showing = true;
    injectStyle();

    const d = queue.shift();
    const previousFocus = document.activeElement;
    const color = COLORS[d.type] || COLORS.info;

    const overlay = document.createElement("div");
    overlay.className = "ud-overlay";
    overlay.setAttribute("role", d.isConfirm ? "alertdialog" : "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.innerHTML = `
        <div class="ud-box">
            <div class="ud-icon"></div>
            <h3 class="ud-title"></h3>
            <p class="ud-message"></p>
            ${d.agreeText
                ? '<label class="ud-agree"><input type="checkbox" data-agree><span></span></label>'
                : ""}
            <div class="ud-actions">
                ${d.isConfirm
                    ? '<button type="button" class="ud-btn ud-btn-secondary" data-cancel></button>'
                    : ""}
                <button type="button" class="ud-btn ${d.danger ? "ud-btn-danger" : "ud-btn-primary"}" data-ok></button>
            </div>
        </div>
    `;

    // textContent keeps user/Firestore text safe from HTML injection.
    const icon = overlay.querySelector(".ud-icon");
    icon.textContent = ICONS[d.type] || ICONS.info;
    icon.style.background = color;

    overlay.querySelector(".ud-title").textContent = d.title;

    const messageEl = overlay.querySelector(".ud-message");
    messageEl.textContent = d.message;

    // Multi-line messages (e.g. rule lists) read better left-aligned.
    messageEl.style.textAlign = d.message.includes("\n") ? "left" : "center";

    const okBtn = overlay.querySelector("[data-ok]");
    const cancelBtn = overlay.querySelector("[data-cancel]");

    okBtn.textContent = d.confirmText;
    if (cancelBtn) cancelBtn.textContent = d.cancelText;

    // Optional agreement: the confirm button stays disabled until ticked.
    const agreeBox = overlay.querySelector("[data-agree]");

    if (agreeBox) {
        overlay.querySelector(".ud-agree span").textContent = d.agreeText;
        okBtn.disabled = true;

        agreeBox.addEventListener("change", () => {
            okBtn.disabled = !agreeBox.checked;
        });
    }

    function close(value) {
        document.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();

        try { previousFocus?.focus?.(); } catch (e) {}

        showing = false;
        d.resolve(value);
        showNext();
    }

    function onKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            close(d.isConfirm ? false : true);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();

            if (document.activeElement === cancelBtn) close(false);
            else if (!okBtn.disabled) close(true);
            return;
        }

        // Keep keyboard focus inside the dialog
        if (event.key === "Tab") {
            const buttons = [agreeBox, cancelBtn, okBtn].filter(el => el && !el.disabled);
            const index = buttons.indexOf(document.activeElement);

            event.preventDefault();

            const next = event.shiftKey
                ? buttons[(index - 1 + buttons.length) % buttons.length]
                : buttons[(index + 1) % buttons.length];

            next.focus();
        }
    }

    okBtn.addEventListener("click", () => close(true));
    cancelBtn?.addEventListener("click", () => close(false));

    // Clicking outside closes an alert, but never a confirm.
    overlay.addEventListener("mousedown", event => {
        if (event.target === overlay && !d.isConfirm) close(true);
    });

    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(overlay);

    // Safe default focus: OK for alerts, Cancel for dangerous confirms.
    (agreeBox || (d.isConfirm && d.danger && cancelBtn ? cancelBtn : okBtn)).focus();
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

export function appAlert(message, options = {}) {
    const type = options.type || "info";

    return openDialog({
        message: String(message ?? ""),
        title: options.title || TITLES[type] || TITLES.info,
        type,
        confirmText: options.okText || "OK",
        isConfirm: false,
        danger: false
    });
}

export function appConfirm(message, options = {}) {
    const type = options.type || "question";

    return openDialog({
        message: String(message ?? ""),
        title: options.title || TITLES[type] || TITLES.question,
        type,
        confirmText: options.confirmText || "Yes",
        cancelText: options.cancelText || "Cancel",
        isConfirm: true,
        danger: !!options.danger,
        agreeText: options.agreeText || ""
    });
}

/* ---------------------------------------------------------
   GLOBAL ACCESS
--------------------------------------------------------- */

window.appAlert = appAlert;
window.appConfirm = appConfirm;

function guessType(message) {
    const text = String(message ?? "").toLowerCase();

    if (/unable|error|fail|invalid|denied|restricted|terminated|cannot|can't/.test(text)) {
        return "error";
    }
    if (/success|saved|submitted|created|updated/.test(text)) {
        return "success";
    }
    if (/please|warning|must|required/.test(text)) {
        return "warning";
    }
    return "info";
}

/*
   Safety net: any leftover alert("...") on a page that imports this
   file will also use the styled dialog. Note it does NOT pause the
   code like the native alert, so code that redirects right after an
   alert() should use `await appAlert(...)` instead.
   (confirm() cannot be overridden this way: use `await appConfirm`.)
*/
window.alert = function (message) {
    appAlert(message, { type: guessType(message) });
};
